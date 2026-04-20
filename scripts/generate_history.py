#!/usr/bin/env python3
"""Genera historico sintetico coherente para QuantumLeap.

Inserta 30 dias por defecto para:
- IndoorEnvironmentObserved
- NoiseLevelObserved
- CrowdFlowObserved

Resolucion por defecto: 5 minutos (agregada desde dinamica conceptual de 30 s).
"""

from __future__ import annotations

import argparse
import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Tuple

import requests

from catalog import MUSEUMS, ORION_ENTITY_HEADERS, ROOMS
from ngsi_utils import bulk_upsert_orion, ngsi_property


@dataclass
class RoomRuntime:
    hvac_active: bool = False


def to_iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat()


def room_code(room_id: str) -> str:
    return room_id.split(":")[-1]


def is_weekend(dt: datetime) -> bool:
    return dt.weekday() >= 5


def gaussian_peak(hour: float, center: float, width: float) -> float:
    return math.exp(-((hour - center) ** 2) / (2 * width**2))


def occupancy_profile(room: Dict, museum_code: str, ts: datetime) -> int:
    hour = ts.hour + ts.minute / 60.0
    weekend = is_weekend(ts)

    cap = room["capacity"]
    room_type = room["roomType"]

    midday_peak = gaussian_peak(hour, 13.2, 2.0)
    evening_peak = gaussian_peak(hour, 20.0, 1.6)
    morning_peak = gaussian_peak(hour, 11.0, 1.8)

    if room_type == "exhibition":
        base_ratio = 0.06 + 0.42 * midday_peak + 0.12 * morning_peak
        if weekend:
            base_ratio *= 1.35
    elif room_type == "performance":
        base_ratio = 0.05 + 0.25 * midday_peak + 0.55 * evening_peak
        if museum_code in {"rosalia", "opera"} and 19.0 <= hour <= 22.5:
            base_ratio += 0.20
        if weekend:
            base_ratio *= 1.20
    elif room_type == "lobby":
        base_ratio = 0.08 + 0.28 * midday_peak + 0.35 * evening_peak
        if weekend:
            base_ratio *= 1.25
    else:
        base_ratio = 0.03 + 0.1 * midday_peak

    base_ratio = min(0.96, max(0.0, base_ratio))
    mean_people = cap * base_ratio
    noise = random.gauss(0.0, max(2.0, cap * 0.01))
    people = int(max(0, min(cap, round(mean_people + noise))))
    return people


def illuminance_profile(room: Dict, ts: datetime) -> float:
    hour = ts.hour + ts.minute / 60.0
    room_type = room["roomType"]

    if 9.5 <= hour <= 19.5:
        base = 220.0 if room_type == "exhibition" else 180.0
    elif 19.5 < hour <= 23.0:
        base = 140.0 if room_type == "performance" else 70.0
    else:
        base = 20.0
    return max(5.0, base + random.gauss(0, 7))


def compute_environment(
    room: Dict,
    museum_code: str,
    ts: datetime,
    runtime: RoomRuntime,
    people: int,
) -> Tuple[Dict, Dict, Dict]:
    hour = ts.hour + ts.minute / 60.0
    perf_show = museum_code in {"rosalia", "opera"} and 19.0 <= hour <= 22.5

    base_temp = 20.3 if room["roomType"] == "exhibition" else 21.0
    base_hum = 50.0 if room["roomType"] == "exhibition" else 47.0
    base_co2 = 520.0
    base_noise = 44.0 if room["roomType"] == "exhibition" else 52.0

    visitor_units = people / 10.0

    hvac_cooling = 0.8 if runtime.hvac_active else 0.0
    hvac_co2_reduction = 110.0 if runtime.hvac_active else 0.0
    hvac_humidity_recovery = 0.6 if runtime.hvac_active else 0.0

    temperature = (
        base_temp
        + 0.3 * visitor_units
        - hvac_cooling
        + 0.4 * math.sin((hour - 8) / 24.0 * math.tau)
        + random.gauss(0, 0.18)
    )
    humidity = (
        base_hum
        - 0.8 * visitor_units
        + hvac_humidity_recovery
        + random.gauss(0, 0.35)
    )
    co2 = (
        base_co2
        + 45.0 * visitor_units
        - hvac_co2_reduction
        + random.gauss(0, 12.0)
    )

    # Regla de accion HVAC por CO2.
    if co2 > 1000:
        runtime.hvac_active = True
    elif co2 < 850:
        runtime.hvac_active = False

    laeq = base_noise + (2.0 if people > 20 else 0.0) + (8.0 if perf_show else 0.0) + random.gauss(0, 1.4)
    lamax = laeq + 8.5 + random.gauss(0, 1.3)
    las = laeq + 2.0 + random.gauss(0, 0.8)

    occupancy = round(min(1.0, people / max(1, room["capacity"])), 3)
    people_in = max(0, int(people * (0.55 + random.uniform(-0.12, 0.12))))
    people_out = max(0, int(people * (0.34 + random.uniform(-0.08, 0.08))))

    env = {
        "temperature": round(temperature, 2),
        "relativeHumidity": round(max(20.0, min(85.0, humidity)), 2),
        "co2": round(max(380.0, co2), 2),
        "illuminance": round(illuminance_profile(room, ts), 2),
        "atmosphericPressure": round(1013.0 + random.gauss(0, 2.4), 2),
        "peopleCount": people,
    }

    noise = {
        "LAeq": round(max(30.0, laeq), 2),
        "LAmax": round(max(35.0, lamax), 2),
        "LAS": round(max(32.0, las), 2),
    }

    crowd = {
        "peopleCount": people,
        "peopleCountTowards": people_in,
        "peopleCountAway": people_out,
        "occupancy": occupancy,
        "averageCrowdSpeed": round(max(0.2, 1.1 - occupancy * 0.7 + random.gauss(0, 0.07)), 2),
        "averageHeadwayTime": round(max(0.2, 3.2 - occupancy * 2.1 + random.gauss(0, 0.15)), 2),
        "congested": occupancy > 0.8,
        "direction": "inbound" if people_in >= people_out else "outbound",
    }

    return env, noise, crowd


def event_windows(now: datetime) -> List[Dict]:
    return [
        {
            "event_id": "co2-elevado",
            "room_id": "urn:ngsi-ld:Room:rosalia-patio-butacas",
            "start": now - timedelta(days=6, hours=4),
            "end": now - timedelta(days=6, hours=3, minutes=15),
            "kind": "co2",
            "alert_type": "CO2Exceeded",
        },
        {
            "event_id": "humedad-baja",
            "room_id": "urn:ngsi-ld:Room:bellasartes-sargadelos",
            "start": now - timedelta(days=14, hours=1),
            "end": now - timedelta(days=14, minutes=20),
            "kind": "humidity",
            "alert_type": "HumidityOutOfRange",
        },
        {
            "event_id": "device-fault",
            "room_id": "urn:ngsi-ld:Room:muncyt-creadores",
            "start": now - timedelta(days=3, hours=2),
            "end": now - timedelta(days=3, hours=1, minutes=25),
            "kind": "device",
            "alert_type": "DeviceFailurePredicted",
        },
    ]


def apply_alert_event(event: Dict, ts: datetime, room: Dict, env: Dict, noise: Dict, crowd: Dict):
    if not (event["start"] <= ts <= event["end"]):
        return

    if event["kind"] == "co2":
        env["co2"] = max(env["co2"], 1320 + random.uniform(0, 110))
        env["temperature"] += 0.7
    elif event["kind"] == "humidity":
        env["relativeHumidity"] = min(env["relativeHumidity"], 33 + random.uniform(-1.5, 1.5))
        env["temperature"] += 0.2
    elif event["kind"] == "device":
        # La anomalia de dispositivo se refleja con ruido erratico y latencia alta.
        noise["LAeq"] += random.uniform(4.0, 7.0)
        crowd["congested"] = True


def ql_entity(entity_id: str, entity_type: str, attrs: Dict, timestamp: str) -> Dict:
    payload = {
        "id": entity_id,
        "type": entity_type,
        "TimeInstant": {"type": "DateTime", "value": timestamp},
    }
    for key, value in attrs.items():
        attr_type = "Text" if isinstance(value, str) else "Boolean" if isinstance(value, bool) else "Number"
        payload[key] = {"type": attr_type, "value": value}
    return payload


def post_ql_batch(ql_url: str, entities: List[Dict], fiware_service: str = "openiot"):
    if not entities:
        return
    endpoint = f"{ql_url.rstrip('/')}/v2/notify"
    payload = {
        "subscriptionId": "auravault-history-seed",
        "data": entities,
    }
    headers = {
        "Content-Type": "application/json",
        "Fiware-Service": fiware_service,
        "Fiware-ServicePath": "/",
    }
    response = requests.post(endpoint, json=payload, headers=headers, timeout=30)
    if response.status_code >= 400:
        raise RuntimeError(f"QuantumLeap error {response.status_code}: {response.text[:600]}")


def create_alert_entities(orion_url: str, now: datetime):
    alerts = []
    for idx, event in enumerate(event_windows(now), start=1):
        room = next(r for r in ROOMS if r["id"] == event["room_id"])
        room_token = room_code(room["id"])
        alert_id = f"urn:ngsi-ld:Alert:{room_token}-{event['event_id']}-{idx:02d}"
        sev = "critical" if event["kind"] in {"co2", "device"} else "high"
        alerts.append(
            {
                "id": alert_id,
                "type": "Alert",
                "name": ngsi_property(event["alert_type"]),
                "category": ngsi_property("Environment" if event["kind"] != "device" else "Device"),
                "subCategory": ngsi_property(event["alert_type"]),
                "severity": ngsi_property(sev),
                "status": ngsi_property("resolved"),
                "description": ngsi_property(
                    f"Evento historico simulado: {event['alert_type']} en {room['name']}"
                ),
                "alertSource": {"type": "Relationship", "object": room["id"]},
                "dateIssued": ngsi_property(to_iso(event["start"])),
                "validFrom": ngsi_property(to_iso(event["start"])),
                "validTo": ngsi_property(to_iso(event["end"])),
                "dateCreated": ngsi_property(to_iso(event["start"])),
                "dateModified": ngsi_property(to_iso(event["end"])),
                "@context": ["https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"],
            }
        )
    bulk_upsert_orion(orion_url, ORION_ENTITY_HEADERS, alerts)


def build_history(
    ql_url: str,
    orion_url: str,
    days: int,
    step_minutes: int,
    batch_size: int,
    seed: int,
):
    random.seed(seed)

    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    start = now - timedelta(days=days)

    room_runtime = {room["id"]: RoomRuntime() for room in ROOMS}
    museum_code_by_room = {}
    for room in ROOMS:
        museum_id = room["museumId"]
        museum = next(m for m in MUSEUMS if m["id"] == museum_id)
        museum_code_by_room[room["id"]] = museum["code"]

    events = event_windows(now)

    ql_batch: List[Dict] = []
    total_points = 0
    current = start

    print(
        f"[generate_history] Generando historico: {days} dias, paso {step_minutes} min, {len(ROOMS)} salas"
    )

    while current <= now:
        timestamp = to_iso(current)
        for room in ROOMS:
            museum_code = museum_code_by_room[room["id"]]
            people = occupancy_profile(room, museum_code, current)
            env, noise, crowd = compute_environment(
                room,
                museum_code,
                current,
                room_runtime[room["id"]],
                people,
            )

            for event in events:
                if event["room_id"] == room["id"]:
                    apply_alert_event(event, current, room, env, noise, crowd)

            rc = room_code(room["id"])
            env_attrs = {
                "dateObserved": timestamp,
                "refPointOfInterest": room["id"],
                "refDevice": f"urn:ngsi-ld:Device:{rc}-env-01",
                **env,
            }
            noise_attrs = {
                "dateObservedFrom": timestamp,
                "dateObservedTo": timestamp,
                "refPointOfInterest": room["id"],
                "refDevice": f"urn:ngsi-ld:Device:{rc}-noise-01",
                **noise,
            }
            crowd_attrs = {
                "dateObserved": timestamp,
                "dateObservedFrom": timestamp,
                "dateObservedTo": timestamp,
                "refRoadSegment": room["id"],
                "refDevice": f"urn:ngsi-ld:Device:{rc}-crowd-01",
                **crowd,
            }

            ql_batch.append(
                ql_entity(
                    entity_id=f"urn:ngsi-ld:IndoorEnvironmentObserved:{rc}",
                    entity_type="IndoorEnvironmentObserved",
                    attrs=env_attrs,
                    timestamp=timestamp,
                )
            )
            ql_batch.append(
                ql_entity(
                    entity_id=f"urn:ngsi-ld:NoiseLevelObserved:{rc}",
                    entity_type="NoiseLevelObserved",
                    attrs=noise_attrs,
                    timestamp=timestamp,
                )
            )
            ql_batch.append(
                ql_entity(
                    entity_id=f"urn:ngsi-ld:CrowdFlowObserved:{rc}",
                    entity_type="CrowdFlowObserved",
                    attrs=crowd_attrs,
                    timestamp=timestamp,
                )
            )

            # Evento de fallo de dispositivo en historico.
            for event in events:
                if event["kind"] == "device" and event["room_id"] == room["id"] and event["start"] <= current <= event["end"]:
                    ql_batch.append(
                        ql_entity(
                            entity_id=f"urn:ngsi-ld:Device:{rc}-env-01",
                            entity_type="Device",
                            attrs={
                                "deviceState": "fault",
                                "batteryLevel": round(random.uniform(0.08, 0.15), 3),
                                "latencyMs": round(random.uniform(1800, 2600), 1),
                            },
                            timestamp=timestamp,
                        )
                    )

            total_points += 3

        if len(ql_batch) >= batch_size:
            post_ql_batch(ql_url, ql_batch)
            ql_batch.clear()

        current += timedelta(minutes=step_minutes)

    if ql_batch:
        post_ql_batch(ql_url, ql_batch)

    create_alert_entities(orion_url, now)
    print(f"[generate_history] Historico generado. Observaciones: {total_points} (sin contar estado de Device).")
    print("[generate_history] Eventos de alerta historicos: CO2 elevado, humedad fuera de rango, dispositivo en fallo.")


def main():
    parser = argparse.ArgumentParser(description="Genera historico para QuantumLeap")
    parser.add_argument("--ql-url", default="http://localhost:8668")
    parser.add_argument("--orion-url", default="http://localhost:1026/ngsi-ld/v1")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--step-minutes", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=240)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    build_history(
        ql_url=args.ql_url,
        orion_url=args.orion_url,
        days=args.days,
        step_minutes=args.step_minutes,
        batch_size=args.batch_size,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
