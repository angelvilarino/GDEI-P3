#!/usr/bin/env python3
"""Backend Flask + SocketIO para AuraVault."""

from __future__ import annotations

import io
import json
import logging
import math
import os
import random
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock, Thread
from typing import Dict, List, Optional, Tuple

import numpy as np
import requests
from flask import (
    Flask,
    Response,
    jsonify,
    make_response,
    render_template,
    request,
    send_file,
)
from flask_socketio import SocketIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from scripts.catalog import (  # noqa: E402
    MUSEUMS,
    NGSI_LD_CONTEXT,
    ORION_ENTITY_HEADERS,
    ROOM_NEIGHBORS,
    ROOMS,
    room_location,
)
from scripts.ngsi_utils import (  # noqa: E402
    bulk_upsert_orion,
    ngsi_property,
    normalize_entity,
    patch_entity_attrs,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


ORION_URL = os.environ.get("ORION_URL", "http://localhost:1026/ngsi-ld/v1")
QL_URL = os.environ.get("QL_URL", "http://localhost:8668")
GRAFANA_URL = os.environ.get("GRAFANA_URL", "http://localhost:3000")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:latest")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
NOTIFY_URL = os.environ.get("NOTIFY_URL", "http://backend:5000/notify")


app = Flask(
    __name__,
    static_folder=str(ROOT / "backend" / "static"),
    template_folder=str(ROOT / "backend" / "templates"),
)
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET", "auravault-dev-secret")

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

LOGGER = logging.getLogger("auravault.backend")
if not LOGGER.handlers:
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

CACHE_TTL_SECONDS = 30
query_cache: Dict[Tuple[str, str], Tuple[float, object]] = {}
query_cache_lock = Lock()

rate_limit_memory: Dict[str, List[float]] = defaultdict(list)
rate_limit_lock = Lock()

risk_model: Optional[RandomForestRegressor] = None
failure_model: Optional[LogisticRegression] = None

def cache_signature(value: object) -> str:
    return json.dumps(value, sort_keys=True, default=str, ensure_ascii=False)


def cached(namespace: str, key: object, loader):
    cache_key = (namespace, cache_signature(key))
    now = time.time()
    with query_cache_lock:
        item = query_cache.get(cache_key)
        if item and item[0] > now:
            return item[1]

    value = loader()
    with query_cache_lock:
        query_cache[cache_key] = (now + CACHE_TTL_SECONDS, value)
    return value


def clear_cached_queries(namespace: Optional[str] = None):
    with query_cache_lock:
        if namespace is None:
            query_cache.clear()
            return
        for key in [item for item in query_cache if item[0] == namespace]:
            query_cache.pop(key, None)


def request_json(
    method: str,
    url: str,
    headers: Optional[Dict] = None,
    params: Optional[Dict] = None,
    payload: Optional[Dict] = None,
    timeout: float = 15.0,
):
    response = requests.request(
        method=method,
        url=url,
        headers=headers,
        params=params,
        data=json.dumps(payload) if payload is not None else None,
        timeout=timeout,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"HTTP {response.status_code} {url}: {response.text[:400]}")
    if not response.text.strip():
        return None
    content_type = response.headers.get("Content-Type", "").lower()
    if "json" in content_type:
        return response.json()
    return response.text


def orion_headers() -> Dict[str, str]:
    return ORION_ENTITY_HEADERS.copy()


def orion_get(path: str, params: Optional[Dict] = None):
    headers = orion_headers()
    LOGGER.debug("Orion GET %s params=%s", path, params)
    return cached(
        "orion_get",
        {"path": path, "params": params, "headers": headers},
        lambda: request_json("GET", f"{ORION_URL.rstrip('/')}/{path.lstrip('/')}", headers=headers, params=params),
    )


def orion_post(path: str, payload: Dict):
    return request_json("POST", f"{ORION_URL.rstrip('/')}/{path.lstrip('/')}", headers=orion_headers(), payload=payload)


def orion_patch(path: str, payload: Dict):
    return request_json("PATCH", f"{ORION_URL.rstrip('/')}/{path.lstrip('/')}", headers=orion_headers(), payload=payload)


def orion_list(entity_type: Optional[str] = None, q: Optional[str] = None, limit: int = 1000) -> List[Dict]:
    params = {"limit": limit}
    if entity_type:
        params["type"] = entity_type
    if q:
        params["q"] = q
    data = orion_get("entities", params=params)
    raw_entities = data if isinstance(data, list) else []
    
    if raw_entities and entity_type in ("IndoorEnvironmentObserved", "NoiseLevelObserved", "CrowdFlowObserved", "Room", "Museum", "Device", "Actuator"):
        LOGGER.debug(f"[Orion Raw] {entity_type} -> {json.dumps(raw_entities[0])[:200]}...")
        norm = normalize_entity(raw_entities[0])
        LOGGER.debug(f"[Backend Normalized] -> {json.dumps(norm)[:200]}...")
        
    return raw_entities


def orion_get_entity(entity_id: str) -> Optional[Dict]:
    try:
        data = cached(
            "orion_get_entity",
            {"entity_id": entity_id},
            lambda: request_json("GET", f"{ORION_URL.rstrip('/')}/entities/{entity_id}", headers=orion_headers()),
        )
        return data if isinstance(data, dict) else None
    except Exception:  # noqa: BLE001
        return None


def normalize_entities(entities: List[Dict]) -> List[Dict]:
    return [normalize_entity(entity) for entity in entities]


def resolve_center(center_id: str) -> Dict:
    for museum in MUSEUMS:
        if center_id in {museum["id"], museum["code"]}:
            return museum
        if museum["id"].endswith(center_id):
            return museum
    raise KeyError(center_id)


def resolve_room(room_id: str) -> Dict:
    for room in ROOMS:
        if room_id in {room["id"], room["id"].split(":")[-1]}:
            return room
    raise KeyError(room_id)


def center_rooms(center_id: str) -> List[Dict]:
    return [room for room in ROOMS if room["museumId"] == center_id]


def room_latest_entities() -> Tuple[Dict[str, Dict], Dict[str, Dict], Dict[str, Dict]]:
    with ThreadPoolExecutor(max_workers=3) as executor:
        env_future = executor.submit(orion_list, "IndoorEnvironmentObserved", None, 1000)
        noise_future = executor.submit(orion_list, "NoiseLevelObserved", None, 1000)
        crowd_future = executor.submit(orion_list, "CrowdFlowObserved", None, 1000)
        env_entities = normalize_entities(env_future.result())
        noise_entities = normalize_entities(noise_future.result())
        crowd_entities = normalize_entities(crowd_future.result())

    env_by_room: Dict[str, Dict] = {}
    noise_by_room: Dict[str, Dict] = {}
    crowd_by_room: Dict[str, Dict] = {}

    for env in env_entities:
        room_id = env.get("refPointOfInterest")
        if room_id:
            env_by_room[room_id] = env

    for noise in noise_entities:
        room_id = noise.get("refPointOfInterest")
        if room_id:
            noise_by_room[room_id] = noise

    for crowd in crowd_entities:
        room_id = crowd.get("refRoadSegment") or crowd.get("refPointOfInterest")
        if room_id:
            crowd_by_room[room_id] = crowd

    def ql_fallback(room: Dict) -> Dict[str, Dict]:
        series = series_for_room(room["id"], "1h")

        def last_value(points: List[Dict], default):
            if not points:
                return default
            value = points[-1].get("value")
            return default if value is None else value

        return {
            "env": {
                "temperature": last_value(series.get("temperature", []), 21.0),
                "relativeHumidity": last_value(series.get("relativeHumidity", []), 50.0),
                "co2": last_value(series.get("co2", []), 700.0),
                "illuminance": last_value(series.get("illuminance", []), 120.0),
                "peopleCount": last_value(series.get("peopleCount", []), 0.0),
            },
            "noise": {"LAeq": last_value(series.get("LAeq", []), 48.0)},
            "crowd": {"occupancy": last_value(series.get("occupancy", []), 0.0)},
        }

    missing_rooms = [room for room in ROOMS if room["id"] not in env_by_room or room["id"] not in noise_by_room or room["id"] not in crowd_by_room]
    if missing_rooms:
        with ThreadPoolExecutor(max_workers=min(8, len(missing_rooms))) as executor:
            fallback_map = {future: room for future, room in ((executor.submit(ql_fallback, room), room) for room in missing_rooms)}
            for future in as_completed(fallback_map):
                room = fallback_map[future]
                try:
                    fallback = future.result()
                except Exception as exc:  # noqa: BLE001
                    LOGGER.debug("QL fallback failed for %s: %s", room["id"], exc)
                    continue
                if room["id"] not in env_by_room:
                    env_by_room[room["id"]] = fallback["env"]
                if room["id"] not in noise_by_room:
                    noise_by_room[room["id"]] = fallback["noise"]
                if room["id"] not in crowd_by_room:
                    crowd_by_room[room["id"]] = fallback["crowd"]

    return env_by_room, noise_by_room, crowd_by_room


def room_status(room: Dict, env: Optional[Dict], noise: Optional[Dict], crowd: Optional[Dict]) -> str:
    if not env:
        return "attention"

    co2 = float(env.get("co2", 700))
    hum = float(env.get("relativeHumidity", 50))
    temp = float(env.get("temperature", 21))
    laeq = float((noise or {}).get("LAeq", 50))
    occupancy = float((crowd or {}).get("occupancy", 0.0))

    critical = (
        co2 > 1300
        or hum < 35
        or hum > 65
        or temp < 16
        or temp > 28
        or laeq > 82
        or occupancy > 0.95
    )
    if critical:
        return "critical"

    attention = (
        co2 > 1000
        or hum < 40
        or hum > 60
        or temp < 18
        or temp > 25
        or laeq > 70
        or occupancy > 0.8
    )
    return "attention" if attention else "optimal"


def center_snapshot(center_id: str, current_data: Optional[Tuple] = None) -> Dict:
    rooms = center_rooms(center_id)
    if current_data:
        env_by_room, noise_by_room, crowd_by_room = current_data
    else:
        env_by_room, noise_by_room, crowd_by_room = room_latest_entities()

    values = {
        "temperature": [],
        "humidity": [],
        "co2": [],
        "noise": [],
        "occupancy": [],
        "people": [],
    }
    statuses = []

    for room in rooms:
        env = env_by_room.get(room["id"], {})
        noise = noise_by_room.get(room["id"], {})
        crowd = crowd_by_room.get(room["id"], {})

        statuses.append(room_status(room, env, noise, crowd))

        if env:
            values["temperature"].append(float(env.get("temperature", 0.0)))
            values["humidity"].append(float(env.get("relativeHumidity", 0.0)))
            values["co2"].append(float(env.get("co2", 0.0)))
            values["people"].append(float(env.get("peopleCount", 0.0)))
        if noise:
            values["noise"].append(float(noise.get("LAeq", 0.0)))
        if crowd:
            values["occupancy"].append(float(crowd.get("occupancy", 0.0)))

    def avg(lst: List[float]) -> float:
        return round(sum(lst) / len(lst), 2) if lst else None

    status = "optimal"
    if any(s == "critical" for s in statuses):
        status = "critical"
    elif any(s == "attention" for s in statuses):
        status = "attention"

    snapshot = {
        "status": status,
        "avgTemperature": avg(values["temperature"]),
        "avgHumidity": avg(values["humidity"]),
        "avgCo2": avg(values["co2"]),
        "avgNoise": avg(values["noise"]),
        "avgOccupancy": avg(values["occupancy"]),
        "peopleCount": int(sum(values["people"])),
        "roomsCount": len(rooms),
    }

    if snapshot["peopleCount"] == 0 and not values["people"]:
        snapshot["peopleCount"] = None
    return snapshot


def ql_attr_series(entity_id: str, attr: str, last_n: int = 200) -> List[Dict]:
    def loader():
        endpoint = f"{QL_URL.rstrip('/')}/v2/entities/{entity_id}/attrs/{attr}"
        headers = {
            "Accept": "application/json",
            "Fiware-Service": "openiot",
            "Fiware-ServicePath": "/",
        }
        try:
            response = requests.get(endpoint, headers=headers, params={"lastN": last_n}, timeout=12)
            if response.status_code >= 400:
                return []
            data = response.json()

            if isinstance(data, dict) and "values" in data and isinstance(data["values"], list):
                points = []
                indexes = data.get("index", [])
                for idx, value in enumerate(data["values"]):
                    ts = indexes[idx] if idx < len(indexes) else None
                    points.append({"timestamp": ts, "value": value})
                return points

            if isinstance(data, dict):
                for key, val in data.items():
                    if isinstance(val, list):
                        points = []
                        for row in val:
                            if isinstance(row, dict):
                                points.append(
                                    {
                                        "timestamp": row.get("recvTime") or row.get("index") or row.get("timestamp"),
                                        "value": row.get("attrValue") if "attrValue" in row else row.get("value"),
                                    }
                                )
                        if points:
                            return points
        except Exception:  # noqa: BLE001
            return []
        return []

    return cached("ql_attr_series", {"entity_id": entity_id, "attr": attr, "last_n": last_n}, loader)
    return []


def to_float(value, default=0.0) -> float:
    try:
        return float(value)
    except Exception:  # noqa: BLE001
        return default


def series_for_room(room_id: str, range_key: str = "24h") -> Dict[str, List[Dict]]:
    mapping = {"1h": 20, "6h": 90, "12h": 150, "24h": 300, "7d": 900, "30d": 1500}
    n = mapping.get(range_key, 300)

    room = resolve_room(room_id)
    rc = room["id"].split(":")[-1]

    env_id = f"urn:ngsi-ld:IndoorEnvironmentObserved:{rc}"
    noise_id = f"urn:ngsi-ld:NoiseLevelObserved:{rc}"
    crowd_id = f"urn:ngsi-ld:CrowdFlowObserved:{rc}"

    data = {
        "temperature": ql_attr_series(env_id, "temperature", n),
        "relativeHumidity": ql_attr_series(env_id, "relativeHumidity", n),
        "co2": ql_attr_series(env_id, "co2", n),
        "illuminance": ql_attr_series(env_id, "illuminance", n),
        "peopleCount": ql_attr_series(env_id, "peopleCount", n),
        "LAeq": ql_attr_series(noise_id, "LAeq", n),
        "occupancy": ql_attr_series(crowd_id, "occupancy", n),
    }

    # Fallback derivado del estado actual si QuantumLeap aun no tiene datos.
    if not any(data.values()):
        env_by_room, noise_by_room, crowd_by_room = room_latest_entities()
        env = env_by_room.get(room["id"], {})
        noise = noise_by_room.get(room["id"], {})
        crowd = crowd_by_room.get(room["id"], {})
        ts = utc_now()
        data = {
            "temperature": [{"timestamp": ts, "value": env.get("temperature", 21.0)}],
            "relativeHumidity": [{"timestamp": ts, "value": env.get("relativeHumidity", 50.0)}],
            "co2": [{"timestamp": ts, "value": env.get("co2", 700.0)}],
            "illuminance": [{"timestamp": ts, "value": env.get("illuminance", 120.0)}],
            "peopleCount": [{"timestamp": ts, "value": env.get("peopleCount", 0)}],
            "LAeq": [{"timestamp": ts, "value": noise.get("LAeq", 48.0)}],
            "occupancy": [{"timestamp": ts, "value": crowd.get("occupancy", 0.0)}],
        }
    return data


def fit_models():
    global risk_model, failure_model

    # Modelo de riesgo de degradacion de obra.
    n = 5000
    rng = np.random.default_rng(42)
    temp_dev = rng.uniform(0, 8, n)
    hum_dev = rng.uniform(0, 20, n)
    co2_dev = rng.uniform(0, 900, n)
    lux_dev = rng.uniform(0, 250, n)
    noise_dev = rng.uniform(0, 35, n)
    X = np.column_stack([temp_dev, hum_dev, co2_dev, lux_dev, noise_dev])
    y = (
        0.24 * (temp_dev / 8)
        + 0.24 * (hum_dev / 20)
        + 0.24 * (co2_dev / 900)
        + 0.14 * (lux_dev / 250)
        + 0.14 * (noise_dev / 35)
        + rng.normal(0, 0.03, n)
    )
    y = np.clip(y, 0.0, 1.0)
    risk_model = RandomForestRegressor(n_estimators=120, random_state=42)
    risk_model.fit(X, y)

    # Modelo de prediccion de fallo de dispositivo (7 dias de tendencia).
    n2 = 3000
    battery_slope = rng.uniform(-0.08, 0.01, n2)
    latency_slope = rng.uniform(-30, 160, n2)
    battery_now = rng.uniform(0.02, 1.0, n2)
    latency_now = rng.uniform(40, 2500, n2)
    X2 = np.column_stack([battery_slope, latency_slope, battery_now, latency_now])

    z = (
        -18 * battery_slope
        + 0.009 * latency_slope
        + 1.2 * (1.0 - battery_now)
        + 0.0012 * latency_now
        - 1.5
    )
    p = 1 / (1 + np.exp(-z))
    y2 = (p > 0.52).astype(int)

    failure_model = LogisticRegression(max_iter=1200)
    failure_model.fit(X2, y2)


def artwork_entities() -> List[Dict]:
    return normalize_entities(orion_list("Artwork", limit=1000))


def room_entities() -> List[Dict]:
    return normalize_entities(orion_list("Room", limit=1000))


def device_entities() -> List[Dict]:
    return normalize_entities(orion_list("Device", limit=1000))


def actuator_entities() -> List[Dict]:
    return normalize_entities(orion_list("Actuator", limit=1000))


def alert_entities() -> List[Dict]:
    return normalize_entities(orion_list("Alert", limit=1000))


def artwork_risk_features(artwork: Dict, env: Dict, noise: Dict) -> List[float]:
    req = artwork.get("conservationRequirements", {}) if isinstance(artwork.get("conservationRequirements"), dict) else {}

    temp = to_float(env.get("temperature", 21.0), 21.0)
    hum = to_float(env.get("relativeHumidity", 50.0), 50.0)
    co2 = to_float(env.get("co2", 700.0), 700.0)
    lux = to_float(env.get("illuminance", 120.0), 120.0)
    db = to_float(noise.get("LAeq", 48.0), 48.0)

    temp_min = to_float(req.get("temperatureMin", 18), 18)
    temp_max = to_float(req.get("temperatureMax", 22), 22)
    hum_min = to_float(req.get("humidityMin", 45), 45)
    hum_max = to_float(req.get("humidityMax", 55), 55)
    co2_max = to_float(req.get("co2Max", 1000), 1000)
    lux_max = to_float(req.get("illuminanceMax", 150), 150)
    noise_max = to_float(req.get("noiseMax", 60), 60)

    temp_dev = max(0.0, temp_min - temp, temp - temp_max)
    hum_dev = max(0.0, hum_min - hum, hum - hum_max)
    co2_dev = max(0.0, co2 - co2_max)
    lux_dev = max(0.0, lux - lux_max)
    noise_dev = max(0.0, db - noise_max)

    return [temp_dev, hum_dev, co2_dev, lux_dev, noise_dev]


def refresh_artwork_risks(center_id: Optional[str] = None) -> int:
    if risk_model is None:
        return 0

    env_by_room, noise_by_room, _ = room_latest_entities()

    updated = 0
    for artwork in artwork_entities():
        room_id = artwork.get("isExposedIn")
        if not room_id:
            continue
        if center_id:
            room = next((r for r in ROOMS if r["id"] == room_id), None)
            if not room or room["museumId"] != center_id:
                continue

        env = env_by_room.get(room_id, {})
        noise = noise_by_room.get(room_id, {})
        features = np.array([artwork_risk_features(artwork, env, noise)])
        risk = float(np.clip(risk_model.predict(features)[0], 0.0, 1.0))

        if risk >= 0.8:
            status = "critical"
        elif risk >= 0.55:
            status = "risk"
        elif risk >= 0.35:
            status = "watch"
        else:
            status = "good"

        attrs = {
            "degradationRisk": ngsi_property(round(risk, 4)),
            "conditionStatus": ngsi_property(status),
            "stressAccumulated": ngsi_property(round(min(1.0, risk * 1.25), 4)),
            "lastAssessmentDate": ngsi_property(utc_now()),
            "dateModified": ngsi_property(utc_now()),
        }
        try:
            patch_entity_attrs(ORION_URL, ORION_ENTITY_HEADERS, artwork["id"], attrs)
            updated += 1
        except Exception:  # noqa: BLE001
            continue

    return updated


def create_alert(room_id: str, subtype: str, severity: str, description: str):
    alerts = alert_entities()
    for existing in alerts:
        if (
            existing.get("alertSource") == room_id
            and existing.get("subCategory") == subtype
            and existing.get("status", "open") in {"open", "acknowledged"}
        ):
            return existing.get("id")

    token = room_id.split(":")[-1]
    alert_id = f"urn:ngsi-ld:Alert:{token}-{subtype.lower()}-{int(time.time())}"

    payload = {
        "id": alert_id,
        "type": "Alert",
        "name": ngsi_property(subtype),
        "category": ngsi_property("Environment"),
        "subCategory": ngsi_property(subtype),
        "severity": ngsi_property(severity),
        "status": ngsi_property("open"),
        "description": ngsi_property(description),
        "alertSource": {"type": "Relationship", "object": room_id},
        "dateIssued": ngsi_property(utc_now()),
        "validFrom": ngsi_property(utc_now()),
        "dateCreated": ngsi_property(utc_now()),
        "dateModified": ngsi_property(utc_now()),
        "@context": [NGSI_LD_CONTEXT],
    }
    bulk_upsert_orion(ORION_URL, ORION_ENTITY_HEADERS, [payload])
    socketio.emit("alerts", {"action": "created", "alertId": alert_id, "severity": severity})
    return alert_id


def evaluate_thresholds(room_id: str, env: Dict, noise: Optional[Dict], crowd: Optional[Dict]):
    co2 = to_float(env.get("co2", 0))
    hum = to_float(env.get("relativeHumidity", 50))
    temp = to_float(env.get("temperature", 21))
    db = to_float((noise or {}).get("LAeq", 50))
    occupancy = to_float((crowd or {}).get("occupancy", 0))

    if co2 > 1200:
        create_alert(room_id, "CO2Critical", "critical", f"CO2 crítico ({co2:.0f} ppm) en {room_id}")
    elif co2 > 1000:
        create_alert(room_id, "CO2Exceeded", "high", f"CO2 alto ({co2:.1f} ppm) en {room_id}")

    if hum < 35 or hum > 65:
        create_alert(room_id, "HumidityCritical", "critical", f"Humedad crítica ({hum:.1f}%) en {room_id}")
    elif hum < 40 or hum > 60:
        create_alert(room_id, "HumidityOutOfRange", "high", f"Humedad fuera de rango ({hum:.1f}%) en {room_id}")

    if temp < 16 or temp > 28:
        create_alert(room_id, "TemperatureCritical", "critical", f"Temperatura crítica ({temp:.1f} C)")
    elif temp < 18 or temp > 25:
        create_alert(room_id, "TemperatureOutOfRange", "medium", f"Temperatura fuera de rango ({temp:.1f} C)")

    if db > 82:
        create_alert(room_id, "NoiseCritical", "critical", f"Ruido crítico ({db:.1f} dB(A))")
    elif db > 74:
        create_alert(room_id, "NoiseExceeded", "medium", f"Ruido elevado ({db:.1f} dB(A))")

    if occupancy > 0.95:
        create_alert(room_id, "CrowdingCritical", "critical", f"Aforo crítico ({occupancy*100:.1f}%)")
    elif occupancy > 0.9:
        create_alert(room_id, "CrowdingDetected", "high", f"Ocupación elevada ({occupancy*100:.1f}%)")


def check_rate_limit(ip: str, max_per_minute: int = 12) -> bool:
    now = time.time()
    with rate_limit_lock:
        history = rate_limit_memory[ip]
        history[:] = [t for t in history if now - t < 60]
        if len(history) >= max_per_minute:
            return False
        history.append(now)
        return True


def build_chat_context(poi_id: str, room_id: Optional[str] = None) -> Dict:
    center = resolve_center(poi_id)
    rooms = center_rooms(center["id"])

    if room_id:
        room = resolve_room(room_id)
    else:
        room = rooms[0] if rooms else None

    env_by_room, _, _ = room_latest_entities()
    env = env_by_room.get(room["id"], {}) if room else {}

    artworks = []
    if room:
        artworks = [
            art
            for art in artwork_entities()
            if art.get("isExposedIn") == room["id"]
        ]

    context = {
        "poi_id": center["id"],
        "poi_name": center["name"],
        "room_id": room["id"] if room else None,
        "room_name": room["name"] if room else None,
        "environment": {
            "temperature": env.get("temperature"),
            "relativeHumidity": env.get("relativeHumidity"),
            "co2": env.get("co2"),
            "peopleCount": env.get("peopleCount"),
            "illuminance": env.get("illuminance"),
        },
        "artworks": [
            {
                "id": art.get("id"),
                "name": art.get("name"),
                "artist": art.get("artist"),
                "year": art.get("year"),
                "material": art.get("material"),
            }
            for art in artworks
        ],
        "timestamp": utc_now(),
    }
    return context


def llm_answer(question: str, language: str, context: Dict) -> str:
    system_prompt = (
        "Eres AuraVault Assistant para visitantes de museos y teatros. "
        "Responde breve, clara y amablemente en el idioma solicitado (es o en). "
        "Usa solo la informacion del contexto recibido. "
        "No inventes datos. Si falta informacion, indicalo claramente."
    )
    full_prompt = (
        f"System: {system_prompt}\n"
        f"Idioma: {language}\n"
        f"Contexto JSON: {json.dumps(context, ensure_ascii=False)}\n"
        f"Pregunta visitante: {question}\n"
        "Respuesta:"
    )

    # Primario: Ollama local.
    try:
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": full_prompt,
            "stream": False,
            "options": {"temperature": 0.2},
        }
        response = requests.post(OLLAMA_URL, json=payload, timeout=3.5)
        if response.status_code == 200:
            data = response.json()
            answer = data.get("response", "").strip()
            if answer:
                return answer
    except Exception:  # noqa: BLE001
        pass

    # Fallback opcional OpenAI.
    if OPENAI_API_KEY:
        try:
            payload = {
                "model": OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": (
                            f"Idioma: {language}\n"
                            f"Contexto: {json.dumps(context, ensure_ascii=False)}\n"
                            f"Pregunta: {question}"
                        ),
                    },
                ],
                "temperature": 0.2,
                "max_tokens": 240,
            }
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            }
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=3.5,
            )
            if response.status_code == 200:
                data = response.json()
                text = data["choices"][0]["message"]["content"].strip()
                if text:
                    return text
        except Exception:  # noqa: BLE001
            pass

    # Fallback final construido desde contexto.
    env = context.get("environment", {})
    room_name = context.get("room_name") or "la sala seleccionada"
    if language == "en":
        return (
            f"I cannot reach the language model right now. Based on Orion data for {room_name}: "
            f"temperature {env.get('temperature', 'n/a')} C, humidity {env.get('relativeHumidity', 'n/a')}%, "
            f"CO2 {env.get('co2', 'n/a')} ppm."
        )
    return (
        f"No he podido contactar con el modelo local en este momento. Segun Orion para {room_name}: "
        f"temperatura {env.get('temperature', 'n/d')} C, humedad {env.get('relativeHumidity', 'n/d')}%, "
        f"CO2 {env.get('co2', 'n/d')} ppm."
    )


def comfort_index(env: Dict, crowd: Dict) -> float:
    temp = to_float(env.get("temperature", 21), 21)
    hum = to_float(env.get("relativeHumidity", 50), 50)
    co2 = to_float(env.get("co2", 700), 700)
    occupancy = to_float(crowd.get("occupancy", 0.0), 0.0)

    temp_score = max(0, 1 - abs(temp - 21) / 9)
    hum_score = max(0, 1 - abs(hum - 50) / 25)
    co2_score = max(0, 1 - max(0, co2 - 600) / 1300)
    occ_score = max(0, 1 - occupancy)
    score = 100 * (0.30 * temp_score + 0.25 * hum_score + 0.30 * co2_score + 0.15 * occ_score)
    return round(score, 2)


def predict_device_failure(device_id: str) -> Dict:
    if failure_model is None:
        return {"probability": 0.0, "maintenance": False}

    device = normalize_entity(orion_get_entity(device_id) or {})
    battery_now = to_float(device.get("batteryLevel", 0.9), 0.9)
    latency_now = to_float(device.get("latencyMs", 100), 100)

    battery_series = ql_attr_series(device_id, "batteryLevel", 300)
    latency_series = ql_attr_series(device_id, "latencyMs", 300)

    def slope(points: List[Dict], fallback: float) -> float:
        if len(points) < 3:
            return fallback
        ys = np.array([to_float(p.get("value"), fallback) for p in points], dtype=float)
        xs = np.arange(len(ys), dtype=float)
        m, _ = np.polyfit(xs, ys, 1)
        return float(m)

    battery_slope = slope(battery_series, -0.002)
    latency_slope = slope(latency_series, 1.2)

    features = np.array([[battery_slope, latency_slope, battery_now, latency_now]])
    prob = float(failure_model.predict_proba(features)[0][1])
    maintenance = prob > 0.62 or battery_now < 0.2 or latency_now > 1300

    return {
        "deviceId": device_id,
        "batterySlope": round(battery_slope, 6),
        "latencySlope": round(latency_slope, 4),
        "probability": round(prob, 4),
        "maintenance": maintenance,
    }


@app.route("/")
def ui_dashboard():
    return render_template("dashboard.html")


@app.route("/centers")
def ui_centers():
    return render_template("centers.html")


@app.route("/center/<center_id>")
def ui_center_detail(center_id: str):
    return render_template("center_detail.html", center_id=center_id)


@app.route("/centers/<center_id>")
def ui_center_detail_alias(center_id: str):
    return render_template("center_detail.html", center_id=center_id)


@app.route("/twin/<center_id>")
def ui_twin(center_id: str):
    return render_template("twin3d.html", center_id=center_id)


@app.route("/room/<room_id>")
def ui_room(room_id: str):
    return render_template("room_artwork.html", room_id=room_id)


@app.route("/control")
def ui_control():
    return render_template("control_center.html")


@app.route("/visitor/<poi_id>")
def ui_visitor(poi_id: str):
    return render_template("visitor.html", poi_id=poi_id)


@app.route("/api/dashboard/summary")
def api_dashboard_summary():
    refresh_artwork_risks()

    centers_payload = []
    total_people = 0
    total_rooms = 0
    status_counts = {"optimal": 0, "attention": 0, "critical": 0}

    # Obtenemos datos globales una sola vez para inyectar en snapshots
    current_data = room_latest_entities()

    with ThreadPoolExecutor(max_workers=min(8, len(MUSEUMS))) as executor:
        future_map = {executor.submit(center_snapshot, center["id"], current_data): center for center in MUSEUMS}
        for future in as_completed(future_map):
            center = future_map[future]
            snap = future.result()
            centers_payload.append({"id": center["id"], "name": center["name"], **snap})
            total_people += snap["peopleCount"] or 0
            total_rooms += snap["roomsCount"] or 0
            status_counts[snap["status"]] += snap["roomsCount"] or 0

    centers_payload.sort(key=lambda item: item["name"])

    artworks = artwork_entities()
    at_risk = [a for a in artworks if to_float(a.get("degradationRisk", 0.0)) > 0.5]

    devices = device_entities()
    active = len([d for d in devices if str(d.get("deviceState", "on")).lower() not in {"off", "fault", "maintenance", "0"}])

    LOGGER.debug(
        "api_dashboard_summary centers=%s rooms=%s people=%s risk=%s devices=%s",
        len(centers_payload),
        total_rooms,
        total_people,
        len(at_risk),
        len(devices),
    )

    return jsonify(
        {
            "timestamp": utc_now(),
            "kpis": {
                "visitorsTotal": total_people,
                "roomsTotal": total_rooms,
                "roomsOptimalPct": round(100 * status_counts["optimal"] / max(1, total_rooms), 2),
                "artworksAtRisk": len(at_risk),
                "sensorsActive": active,
                "sensorsTotal": len(devices),
            },
            "centers": centers_payload,
            "statusCounts": status_counts,
        }
    )


@app.route("/api/model/graph")
def api_model_graph():
    graph = {
        "entities": [
            "Museum",
            "Room",
            "Artwork",
            "Device",
            "Actuator",
            "IndoorEnvironmentObserved",
            "NoiseLevelObserved",
            "CrowdFlowObserved",
            "Alert",
        ],
        "relationships": [
            ["Room", "isLocatedIn", "Museum"],
            ["Artwork", "isExposedIn", "Room"],
            ["Actuator", "isLocatedIn", "Room"],
            ["Actuator", "isControlledBy", "Device"],
        ],
    }
    return jsonify(graph)


@app.route("/api/centers")
def api_centers():
    payload = []
    for center in MUSEUMS:
        snap = center_snapshot(center["id"])
        payload.append(
            {
                "id": center["id"],
                "code": center["code"],
                "name": center["name"],
                "type": center["museumType"][0],
                "location": center["location"],
                "image": center["image"],
                "status": snap["status"],
                "snapshot": snap,
            }
        )

    LOGGER.debug("api_centers raw=%s", len(payload))

    center_type = request.args.get("type")
    status = request.args.get("status")
    occupancy = request.args.get("occupancy")

    if center_type:
        payload = [p for p in payload if center_type in p["type"]]
    if status:
        payload = [p for p in payload if p["status"] == status]
    if occupancy:
        if occupancy == "free":
            payload = [p for p in payload if p["snapshot"]["avgOccupancy"] < 0.35]
        elif occupancy == "moderate":
            payload = [p for p in payload if 0.35 <= p["snapshot"]["avgOccupancy"] <= 0.70]
        elif occupancy == "congested":
            payload = [p for p in payload if p["snapshot"]["avgOccupancy"] > 0.70]

    LOGGER.debug("api_centers filtered type=%s status=%s occupancy=%s -> %s", center_type, status, occupancy, len(payload))

    return jsonify(payload)


@app.route("/api/centers/<center_id>")
def api_center_detail(center_id: str):
    center = resolve_center(center_id)
    snap = center_snapshot(center["id"])
    
    # Verificación rápida de Grafana
    grafana_ok = False
    try:
        g_url = f"{GRAFANA_URL.rstrip('/')}/api/health"
        # Usamos un timeout muy corto para no bloquear la UI
        resp = requests.get(g_url, timeout=1.0)
        grafana_ok = resp.status_code == 200
    except Exception:
        grafana_ok = False
        
    return jsonify({**center, "snapshot": snap, "grafanaAlive": grafana_ok})


@app.route("/api/centers/<center_id>/snapshot")
def api_center_snapshot(center_id: str):
    center = resolve_center(center_id)
    snap = center_snapshot(center["id"])
    LOGGER.debug("api_center_snapshot center=%s rooms=%s status=%s", center["code"], snap["roomsCount"], snap["status"])
    return jsonify(snap)


@app.route("/api/centers/<center_id>/trend")
def api_center_trend(center_id: str):
    center = resolve_center(center_id)
    range_key = request.args.get("range", "12h")
    rooms = center_rooms(center["id"])

    temp_series = []
    people_series = []
    for room in rooms:
        s = series_for_room(room["id"], range_key)
        temp_series.extend(s.get("temperature", []))
        people_series.extend(s.get("peopleCount", []))

    def aggregate(points: List[Dict]) -> List[Dict]:
        grouped: Dict[str, List[float]] = defaultdict(list)
        for p in points:
            ts = p.get("timestamp") or utc_now()
            grouped[str(ts)].append(to_float(p.get("value"), 0.0))
        out = []
        for ts, vals in sorted(grouped.items()):
            out.append({"timestamp": ts, "value": round(sum(vals) / len(vals), 3)})
        return out

    return jsonify({"temperature": aggregate(temp_series), "peopleCount": aggregate(people_series)})


@app.route("/api/centers/<center_id>/rooms")
def api_center_rooms(center_id: str):
    center = resolve_center(center_id)
    env_by_room, noise_by_room, crowd_by_room = room_latest_entities()

    payload = []
    for room in center_rooms(center["id"]):
        env = env_by_room.get(room["id"], {})
        noise = noise_by_room.get(room["id"], {})
        crowd = crowd_by_room.get(room["id"], {})
        payload.append(
            {
                **room,
                "location": room_location(room),
                "status": room_status(room, env, noise, crowd),
                "current": {
                    "temperature": env.get("temperature"),
                    "relativeHumidity": env.get("relativeHumidity"),
                    "co2": env.get("co2"),
                    "illuminance": env.get("illuminance"),
                    "peopleCount": env.get("peopleCount"),
                    "LAeq": noise.get("LAeq"),
                    "occupancy": crowd.get("occupancy"),
                },
            }
        )
    LOGGER.debug("api_center_rooms center=%s rooms=%s", center["code"], len(payload))
    return jsonify(payload)


@app.route("/api/centers/<center_id>/artworks/at-risk")
def api_center_artworks_risk(center_id: str):
    center = resolve_center(center_id)
    refresh_artwork_risks(center["id"])

    room_ids = {r["id"] for r in center_rooms(center["id"])}
    result = []
    for art in artwork_entities():
        if art.get("isExposedIn") not in room_ids:
            continue
        risk = to_float(art.get("degradationRisk", 0.0), 0.0)
        if risk > 0.5:
            result.append(art)

    result.sort(key=lambda x: to_float(x.get("degradationRisk", 0.0), 0.0), reverse=True)
    return jsonify(result)


@app.route("/api/centers/<center_id>/history")
def api_center_history(center_id: str):
    center = resolve_center(center_id)
    range_key = request.args.get("range", "24h")

    result = {
        "temperature": [],
        "relativeHumidity": [],
        "co2": [],
        "LAeq": [],
        "peopleCount": [],
    }

    for room in center_rooms(center["id"]):
        s = series_for_room(room["id"], range_key)
        for key in result:
            result[key].extend(s.get(key, []))

    def aggregate(points: List[Dict]) -> List[Dict]:
        grouped: Dict[str, List[float]] = defaultdict(list)
        for p in points:
            grouped[str(p.get("timestamp"))].append(to_float(p.get("value"), 0.0))
        out = []
        for ts, vals in sorted(grouped.items()):
            out.append({"timestamp": ts, "value": round(sum(vals) / len(vals), 3)})
        return out

    return jsonify({k: aggregate(v) for k, v in result.items()})


@app.route("/api/centers/<center_id>/actuators")
def api_center_actuators(center_id: str):
    center = resolve_center(center_id)
    room_ids = {r["id"] for r in center_rooms(center["id"])}
    acts = [a for a in actuator_entities() if a.get("isLocatedIn") in room_ids]
    return jsonify(acts)


@app.route("/api/centers/<center_id>/3d-scene")
def api_center_3d_scene(center_id: str):
    center = resolve_center(center_id)
    rooms = center_rooms(center["id"])

    scene_rooms = []
    for idx, room in enumerate(rooms):
        loc = room_location(room)
        scene_rooms.append(
            {
                "id": room["id"],
                "name": room["name"],
                "floor": room["floor"],
                "capacity": room["capacity"],
                "area": room["area"],
                "type": room["roomType"],
                "x": idx * 8,
                "y": max(0, room["floor"]) * 4,
                "z": (idx % 3) * 7,
                "geo": loc,
                "neighbors": ROOM_NEIGHBORS.get(room["id"], []),
            }
        )

    return jsonify(
        {
            "center": {"id": center["id"], "name": center["name"], "code": center["code"]},
            "rooms": scene_rooms,
            "shapeHint": {
                "muncyt": "prisma acristalado con 3 niveles de recorrido",
                "bellasartes": "edificio en torno a galerias por niveles",
                "rosalia": "sala italiana con patio, anfiteatro y palcos",
                "opera": "volumen principal + salas anexas de congresos",
            }.get(center["code"], "edificio multi-sala"),
        }
    )


@app.route("/api/rooms/<room_id>")
def api_room_detail(room_id: str):
    room = resolve_room(room_id)
    env_by_room, noise_by_room, crowd_by_room = room_latest_entities()
    env = env_by_room.get(room["id"], {})
    noise = noise_by_room.get(room["id"], {})
    crowd = crowd_by_room.get(room["id"], {})

    return jsonify(
        {
            **room,
            "location": room_location(room),
            "status": room_status(room, env, noise, crowd),
            "current": {
                "temperature": env.get("temperature"),
                "relativeHumidity": env.get("relativeHumidity"),
                "co2": env.get("co2"),
                "illuminance": env.get("illuminance"),
                "peopleCount": env.get("peopleCount"),
                "LAeq": noise.get("LAeq"),
                "LAmax": noise.get("LAmax"),
                "occupancy": crowd.get("occupancy"),
            },
        }
    )


@app.route("/api/rooms/<room_id>/environment/current")
def api_room_environment_current(room_id: str):
    room = resolve_room(room_id)
    env_by_room, noise_by_room, crowd_by_room = room_latest_entities()
    env = env_by_room.get(room["id"], {})
    noise = noise_by_room.get(room["id"], {})
    crowd = crowd_by_room.get(room["id"], {})

    return jsonify({"roomId": room["id"], "environment": env, "noise": noise, "crowd": crowd})


@app.route("/api/rooms/<room_id>/history")
def api_room_history(room_id: str):
    range_key = request.args.get("range", "24h")
    return jsonify(series_for_room(resolve_room(room_id)["id"], range_key))


@app.route("/api/rooms/<room_id>/artworks")
def api_room_artworks(room_id: str):
    room = resolve_room(room_id)
    refresh_artwork_risks(room["museumId"])
    arts = [a for a in artwork_entities() if a.get("isExposedIn") == room["id"]]
    return jsonify(arts)


@app.route("/api/rooms/<room_id>/connections")
def api_room_connections(room_id: str):
    room = resolve_room(room_id)
    return jsonify({"roomId": room["id"], "neighbors": ROOM_NEIGHBORS.get(room["id"], [])})


@app.route("/api/simulations/spread", methods=["POST"])
def api_simulation_spread():
    payload = request.get_json(force=True, silent=True) or {}
    room_id = payload.get("room_id")
    if not room_id:
        return jsonify({"error": "room_id is required"}), 400
    room = resolve_room(room_id)
    chain = [room["id"]] + ROOM_NEIGHBORS.get(room["id"], [])
    frames = []
    for idx, rid in enumerate(chain):
        frames.append({"roomId": rid, "delayMs": idx * 700, "intensity": round(max(0.2, 1 - idx * 0.25), 2)})
    return jsonify({"origin": room["id"], "frames": frames})


@app.route("/api/stream/updates")
def api_stream_updates():
    return jsonify({"transport": "socketio", "namespace": "/", "channels": ["update", "alerts", "devices", "actuators"]})


@app.route("/api/artworks/<artwork_id>")
def api_artwork_detail(artwork_id: str):
    refresh_artwork_risks()
    artwork = next((a for a in artwork_entities() if artwork_id in {a.get("id"), a.get("id", "").split(":")[-1]}), None)
    if not artwork:
        return jsonify({"error": "Artwork not found"}), 404

    room = resolve_room(artwork.get("isExposedIn"))
    env_by_room, noise_by_room, _ = room_latest_entities()
    return jsonify(
        {
            **artwork,
            "room": room,
            "currentEnvironment": env_by_room.get(room["id"], {}),
            "currentNoise": noise_by_room.get(room["id"], {}),
        }
    )


@app.route("/api/artworks/<artwork_id>/history")
def api_artwork_history(artwork_id: str):
    artwork = next((a for a in artwork_entities() if artwork_id in {a.get("id"), a.get("id", "").split(":")[-1]}), None)
    if not artwork:
        return jsonify({"error": "Artwork not found"}), 404
    return jsonify(series_for_room(artwork.get("isExposedIn"), request.args.get("range", "30d")))


@app.route("/api/artworks/<artwork_id>/alerts")
def api_artwork_alerts(artwork_id: str):
    artwork = next((a for a in artwork_entities() if artwork_id in {a.get("id"), a.get("id", "").split(":")[-1]}), None)
    if not artwork:
        return jsonify({"error": "Artwork not found"}), 404

    room_id = artwork.get("isExposedIn")
    alerts = [
        a
        for a in alert_entities()
        if a.get("alertSource") in {artwork.get("id"), room_id}
    ]
    return jsonify(alerts)


@app.route("/api/artworks/compare")
def api_artworks_compare():
    ids = request.args.get("ids", "")
    selected = [item.strip() for item in ids.split(",") if item.strip()][:3]
    all_artworks = artwork_entities()
    result = []
    for sel in selected:
        art = next((a for a in all_artworks if sel in {a.get("id"), a.get("id", "").split(":")[-1]}), None)
        if art:
            result.append(art)
    return jsonify(result)


def build_passport_markdown(room: Dict, history: Dict, artworks: List[Dict]) -> str:
    lines = [
        f"# Pasaporte Ambiental - {room['name']}",
        "",
        f"Fecha de emision: {utc_now()}",
        f"Centro: {room['museumId']}",
        "",
        "## Resumen historico",
    ]
    for key, points in history.items():
        values = [to_float(p.get("value"), 0.0) for p in points]
        if not values:
            continue
        lines.append(
            f"- {key}: media={sum(values)/len(values):.2f}, min={min(values):.2f}, max={max(values):.2f}, muestras={len(values)}"
        )
    lines.append("")
    lines.append("## Obras presentes")
    for art in artworks:
        lines.append(f"- {art.get('name')} ({art.get('artist')}) riesgo={to_float(art.get('degradationRisk', 0.0)):.3f}")
    return "\n".join(lines)


@app.route("/api/rooms/<room_id>/passport")
def api_room_passport(room_id: str):
    room = resolve_room(room_id)
    fmt = request.args.get("format", "pdf").lower()
    history = series_for_room(room["id"], "30d")
    arts = [a for a in artwork_entities() if a.get("isExposedIn") == room["id"]]
    report_md = build_passport_markdown(room, history, arts)

    if fmt == "md":
        return Response(report_md, mimetype="text/markdown")

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 40

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(40, y, f"Pasaporte Ambiental - {room['name']}")
    y -= 24
    pdf.setFont("Helvetica", 10)

    for line in report_md.split("\n"):
        if y < 40:
            pdf.showPage()
            y = height - 40
            pdf.setFont("Helvetica", 10)
        pdf.drawString(40, y, line[:120])
        y -= 14

    pdf.save()
    buffer.seek(0)
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f"pasaporte_{room['id'].split(':')[-1]}.pdf",
        mimetype="application/pdf",
    )


@app.route("/api/admin/alerts")
def api_admin_alerts():
    alerts = alert_entities()

    center = request.args.get("center")
    subtype = request.args.get("type")
    severity = request.args.get("severity")
    status = request.args.get("status")

    def match(alert: Dict) -> bool:
        if subtype and alert.get("subCategory") != subtype:
            return False
        if severity and alert.get("severity") != severity:
            return False
        if status and alert.get("status") != status:
            return False
        if center:
            try:
                c = resolve_center(center)
                room_ids = {r["id"] for r in center_rooms(c["id"])}
                if alert.get("alertSource") not in room_ids:
                    return False
            except Exception:  # noqa: BLE001
                return False
        return True

    payload = []
    for alert in alerts:
        if not match(alert):
            continue
        source = alert.get("alertSource")
        room = next((r for r in ROOMS if r["id"] == source), None)
        center = resolve_center(room["museumId"]) if room else None
        payload.append(
            {
                **alert,
                "roomName": room["name"] if room else None,
                "centerName": center["name"] if center else None,
                "centerCode": center["code"] if center else None,
            }
        )

    LOGGER.debug("api_admin_alerts returned=%s", len(payload))
    return jsonify(payload)


@app.route("/api/admin/alerts/stats")
def api_admin_alerts_stats():
    alerts = alert_entities()

    by_type: Dict[str, int] = defaultdict(int)
    by_center: Dict[str, int] = defaultdict(int)

    for alert in alerts:
        by_type[str(alert.get("subCategory", "Unknown"))] += 1
        source = alert.get("alertSource")
        if source:
            room = next((r for r in ROOMS if r["id"] == source), None)
            if room:
                center = resolve_center(room["museumId"])
                by_center[center["code"]] += 1

    return jsonify({"byType": by_type, "byCenter": by_center})


@app.route("/api/alerts/<alert_id>/resolve", methods=["PATCH"])
def api_alert_resolve(alert_id: str):
    if not alert_id.startswith("urn:"):
        alert_id = f"urn:ngsi-ld:Alert:{alert_id}"

    attrs = {
        "status": ngsi_property("resolved"),
        "dateModified": ngsi_property(utc_now()),
    }
    patch_entity_attrs(ORION_URL, ORION_ENTITY_HEADERS, alert_id, attrs)
    clear_cached_queries()
    socketio.emit("alerts", {"action": "resolved", "alertId": alert_id})
    return jsonify({"ok": True, "alertId": alert_id})


@app.route("/api/admin/devices")
def api_admin_devices():
    devices = device_entities()
    payload = []
    with ThreadPoolExecutor(max_workers=min(12, max(1, len(devices)))) as executor:
        future_map = {executor.submit(predict_device_failure, device["id"]): device for device in devices}
        for future in as_completed(future_map):
            device = future_map[future]
            pred = future.result()
            room_id = device.get("controlledAsset")
            room = next((r for r in ROOMS if r["id"] == room_id), None)
            center = resolve_center(room["museumId"]) if room else None
            payload.append(
                {
                    **device,
                    "prediction": pred,
                    "maintenanceBadge": pred["maintenance"],
                    "roomName": room["name"] if room else None,
                    "centerName": center["name"] if center else None,
                    "centerCode": center["code"] if center else None,
                    "lastReading": device.get("dateLastValueReported") or device.get("dateObserved") or device.get("dateModified"),
                }
            )
    payload.sort(key=lambda item: item.get("name") or item.get("id") or "")
    LOGGER.debug("api_admin_devices devices=%s", len(payload))
    return jsonify(payload)


@app.route("/api/devices/<device_id>")
def api_device_detail(device_id: str):
    if not device_id.startswith("urn:"):
        device_id = f"urn:ngsi-ld:Device:{device_id}"
    entity = normalize_entity(orion_get_entity(device_id) or {})
    if not entity:
        return jsonify({"error": "Device not found"}), 404
    return jsonify(entity)


@app.route("/api/devices/<device_id>/prediction")
def api_device_prediction(device_id: str):
    if not device_id.startswith("urn:"):
        device_id = f"urn:ngsi-ld:Device:{device_id}"
    return jsonify(predict_device_failure(device_id))


@app.route("/api/actuators/<actuator_id>/command", methods=["POST"])
def api_actuator_command(actuator_id: str):
    if not actuator_id.startswith("urn:"):
        actuator_id = f"urn:ngsi-ld:Actuator:{actuator_id}"

    payload = request.get_json(force=True, silent=True) or {}
    command = payload.get("command", "on")
    status = "running" if command in {"on", "start", "enable", "activate"} else "off"

    attrs = {
        "status": ngsi_property(status),
        "commandSent": ngsi_property({"command": command, "at": utc_now(), "by": "api"}),
        "lastActivationDate": ngsi_property(utc_now()),
        "dateModified": ngsi_property(utc_now()),
    }
    patch_entity_attrs(ORION_URL, ORION_ENTITY_HEADERS, actuator_id, attrs)
    clear_cached_queries()
    socketio.emit("actuators", {"id": actuator_id, "status": status, "command": command})
    return jsonify({"ok": True, "id": actuator_id, "status": status})


@app.route("/api/grafana/center/<center_id>")
def api_grafana_center(center_id: str):
    center = resolve_center(center_id)
    return jsonify(
        {
            "url": f"{GRAFANA_URL}/d/auravault-centers/auravault-centers?orgId=1&var-center={center['code']}",
            "embed": f"{GRAFANA_URL}/d/auravault-centers/auravault-centers?orgId=1&kiosk=tv&var-center={center['code']}",
        }
    )


@app.route("/api/grafana/admin")
def api_grafana_admin():
    return jsonify(
        {
            "url": f"{GRAFANA_URL}/d/auravault-ops/auravault-ops?orgId=1",
            "embed": f"{GRAFANA_URL}/d/auravault-ops/auravault-ops?orgId=1&kiosk=tv",
        }
    )


@app.route("/api/public/poi/<poi_id>")
def api_public_poi(poi_id: str):
    center = resolve_center(poi_id)
    return jsonify(center)


@app.route("/api/public/poi/<poi_id>/summary")
def api_public_poi_summary(poi_id: str):
    center = resolve_center(poi_id)
    snap = center_snapshot(center["id"])

    if snap["avgCo2"] <= 700:
        air_status = "excellent"
    elif snap["avgCo2"] <= 1000:
        air_status = "acceptable"
    else:
        air_status = "improvable"

    return jsonify({"center": center, "snapshot": snap, "airStatus": air_status})


@app.route("/api/public/poi/<poi_id>/rooms")
def api_public_poi_rooms(poi_id: str):
    center = resolve_center(poi_id)
    env_by_room, _, crowd_by_room = room_latest_entities()

    data = []
    for room in center_rooms(center["id"]):
        env = env_by_room.get(room["id"], {})
        crowd = crowd_by_room.get(room["id"], {})
        data.append({**room, "comfortIndex": comfort_index(env, crowd), "co2": env.get("co2"), "peopleCount": env.get("peopleCount")})
    return jsonify(data)


@app.route("/api/public/poi/<poi_id>/recommended-room")
def api_public_recommended_room(poi_id: str):
    center = resolve_center(poi_id)
    env_by_room, _, crowd_by_room = room_latest_entities()

    best = None
    for room in center_rooms(center["id"]):
        env = env_by_room.get(room["id"], {})
        crowd = crowd_by_room.get(room["id"], {})
        score = comfort_index(env, crowd)
        item = {"room": room, "comfortIndex": score}
        if best is None or score > best["comfortIndex"]:
            best = item

    return jsonify(best or {})


@app.route("/api/public/chat/context", methods=["POST"])
def api_chat_context():
    payload = request.get_json(force=True, silent=True) or {}
    poi_id = payload.get("poi_id")
    room_id = payload.get("room_id")
    if not poi_id:
        return jsonify({"error": "poi_id is required"}), 400

    context = build_chat_context(poi_id, room_id)
    return jsonify(context)


@app.route("/api/public/chat/ask", methods=["POST"])
def api_chat_ask():
    payload = request.get_json(force=True, silent=True) or {}
    poi_id = payload.get("poi_id")
    room_id = payload.get("room_id")
    question = str(payload.get("question", "")).strip()
    language = payload.get("language", "es")

    if not poi_id or not question:
        return jsonify({"error": "poi_id and question are required"}), 400

    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()
    if not check_rate_limit(ip):
        return jsonify({"error": "Rate limit exceeded"}), 429

    # Mitigacion minima de prompt injection.
    q_low = question.lower()
    if "ignore previous" in q_low or "ignora instrucciones" in q_low:
        question = "Explica el estado ambiental actual de la sala con los datos disponibles."

    context = build_chat_context(poi_id, room_id)
    started = time.time()
    answer = llm_answer(question, language, context)
    elapsed = round((time.time() - started) * 1000)

    return jsonify(
        {
            "answer": answer,
            "sources_used": ["Orion(Room, Artwork, IndoorEnvironmentObserved)", "Ollama"],
            "timestamp": utc_now(),
            "latencyMs": elapsed,
        }
    )


@app.route("/notify", methods=["POST"])
def notify():
    payload = request.get_json(force=True, silent=True) or {}

    data = payload.get("data") if isinstance(payload, dict) else None
    if data is None and isinstance(payload, list):
        data = payload
    if data is None:
        data = []

    processed = 0
    env_by_room, noise_by_room, crowd_by_room = room_latest_entities()

    def minimal_payload(entity: Dict) -> Dict:
        keys = (
            "id",
            "type",
            "status",
            "severity",
            "subCategory",
            "dateModified",
            "dateIssued",
            "deviceState",
            "batteryLevel",
            "refPointOfInterest",
            "refRoadSegment",
            "alertSource",
        )
        return {key: entity.get(key) for key in keys if entity.get(key) is not None}

    for entity in data:
        parsed = normalize_entity(entity)
        e_type = parsed.get("type")
        processed += 1

        socketio.emit("update", minimal_payload(parsed))
        socketio.emit(f"entity:{e_type}", minimal_payload(parsed))

        if e_type == "Alert":
            socketio.emit("alerts", minimal_payload(parsed))
        if e_type in {"Actuator", "Device"}:
            socketio.emit("devices", minimal_payload(parsed))

        if e_type == "IndoorEnvironmentObserved":
            room_id = parsed.get("refPointOfInterest")
            if room_id:
                evaluate_thresholds(room_id, parsed, noise_by_room.get(room_id), crowd_by_room.get(room_id))
                refresh_artwork_risks()

    clear_cached_queries()
    socketio.emit("update", {"action": "notify", "processed": processed, "timestamp": utc_now()})

    return jsonify({"received": processed, "timestamp": utc_now()})


def ensure_orion_subscriptions():
    """Crea suscripciones en Orion-LD si no existen."""
    LOGGER.info("Verificando suscripciones Orion-LD...")
    from scripts.ngsi_utils import create_orion_subscription

    subs = [
        {
            "id": "urn:ngsi-ld:Subscription:AuraVault:Environment",
            "type": "Subscription",
            "@context": "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
            "entities": [{"type": "IndoorEnvironmentObserved"}],
            "watchedAttributes": ["temperature", "relativeHumidity", "co2", "peopleCount"],
            "notification": {
                "endpoint": {"uri": NOTIFY_URL, "accept": "application/json"}
            },
        },
        {
            "id": "urn:ngsi-ld:Subscription:AuraVault:Alerts",
            "type": "Subscription",
            "@context": "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
            "entities": [{"type": "Alert"}],
            "notification": {
                "endpoint": {"uri": NOTIFY_URL, "accept": "application/json"}
            },
        }
    ]

    for sub in subs:
        try:
            h = ORION_ENTITY_HEADERS.copy()
            h["Content-Type"] = "application/ld+json"
            h.pop("Link", None)
            create_orion_subscription(ORION_URL, h, sub)
            LOGGER.info("Suscripción %s asegurada.", sub["id"])
        except Exception as e:
            LOGGER.warning("Error al crear suscripción %s: %s", sub["id"], e)


def background_update_thread():
    """Hilo para emitir actualizaciones de dashboard cada 15 segundos."""
    LOGGER.info("Iniciando hilo de actualización en tiempo real (15s)...")
    while True:
        try:
            with app.app_context():
                summary = api_dashboard_summary().get_json()
                socketio.emit("summary", summary)
        except Exception as e:
            LOGGER.error("Error en background_update_thread: %s", e)
        time.sleep(15)


@socketio.on("connect")
def socket_connect(auth=None):
    summary = api_dashboard_summary().get_json()
    socketio.emit("summary", summary, to=request.sid)
    socketio.emit("update", {"event": "connected", "timestamp": utc_now()})


def startup_checks():
    fit_models()
    ensure_orion_subscriptions()
    update_thread = Thread(target=background_update_thread, daemon=True)
    update_thread.start()
    try:
        # Usamos un tipo concreto para evitar el error "Too broad query"
        _ = orion_list("Museum", limit=1)
        print("[backend] Orion conectado y verificado")
    except Exception as exc:  # noqa: BLE001
        print(f"[backend] Aviso Orion no disponible al arranque: {exc}")


fit_models()

if __name__ == "__main__":
    startup_checks()
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") == "development"
    socketio.run(app, host="0.0.0.0", port=port, debug=debug, use_reloader=False)
