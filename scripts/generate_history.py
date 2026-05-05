#!/usr/bin/env python3
"""Genera historico sintetico continuo para QuantumLeap (24h a 30s de paso)"""

import argparse
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

import requests
from datetime import datetime, timezone, timedelta
import random
import json

from scripts.catalog import ROOMS, MUSEUMS

# Try import simulator logic
try:
    from simulator.mqtt_simulator import update_state, SimState
except ImportError:
    print("Cannot import simulator")
    sys.exit(1)

# Perfiles iniciales distintos por centro para garantizar diversidad
CENTER_PROFILES = {
    "muncyt":      {"temp": 20.5, "hum": 48.0, "co2": 670.0},
    "bellasartes": {"temp": 19.0, "hum": 52.0, "co2": 640.0},
    "rosalia":     {"temp": 21.5, "hum": 44.0, "co2": 740.0},
    "opera":       {"temp": 20.0, "hum": 50.0, "co2": 710.0},
}


def init_state_for_center(room: dict, center_code: str) -> SimState:
    p = CENTER_PROFILES.get(center_code, {"temp": 21.0, "hum": 48.0, "co2": 690.0})
    base_people = max(2, int(room["capacity"] * 0.12))
    return SimState(
        temperature=round(p["temp"] + random.uniform(-1.0, 1.0), 1),
        humidity=round(p["hum"] + random.uniform(-3.0, 3.0), 1),
        co2=round(p["co2"] + random.uniform(-80.0, 100.0), 1),
        illuminance=150.0 + random.uniform(-20, 20),
        pressure=1013.0 + random.uniform(-2, 2),
        people=base_people,
        laeq=45.0 + random.uniform(-3, 3),
        lamax=56.0,
        las=47.0,
        occupancy=base_people / room["capacity"],
        battery=0.99,
        latency_ms=120.0,
        rssi=-59.0,
        hvac_active=False,
    )


def ql_entity(entity_id: str, entity_type: str, attrs: dict, timestamp: str) -> dict:
    payload = {
        "id": entity_id,
        "type": entity_type,
        "TimeInstant": {"type": "DateTime", "value": timestamp},
    }
    for key, value in attrs.items():
        if key in ("dateObserved", "dateObservedFrom", "dateObservedTo"):
            payload[key] = {"type": "DateTime", "value": value}
        elif isinstance(value, bool):
            payload[key] = {"type": "Boolean", "value": value}
        elif isinstance(value, str):
            payload[key] = {"type": "Text", "value": value}
        else:
            payload[key] = {"type": "Number", "value": value}
    return payload

def post_ql_batch(ql_url: str, entities: list, fiware_service: str = "openiot"):
    if not entities: return
    response = requests.post(f"{ql_url.rstrip('/')}/v2/notify", json={"subscriptionId": "auravault-history-seed", "data": entities}, headers={"Content-Type": "application/json", "Fiware-Service": fiware_service, "Fiware-ServicePath": "/"}, timeout=30)
    if response.status_code >= 400: raise RuntimeError(f"QL error: {response.text[:600]}")

def delete_all_history(ql_url):
    print("[generate_history] Borrando datos anteriores...")
    for room in ROOMS:
        rc = room["id"].split(":")[-1]
        for type_ in ["IndoorEnvironmentObserved", "NoiseLevelObserved", "CrowdFlowObserved"]:
            requests.delete(
                f"{ql_url.rstrip('/')}/v2/entities/urn:ngsi-ld:{type_}:{rc}",
                params={"type": type_},
                headers={"Fiware-Service": "openiot", "Fiware-ServicePath": "/"},
                timeout=10,
            )

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ql-url", default="http://localhost:8668")
    parser.add_argument("--orion-url", default="http://localhost:1026/ngsi-ld/v1")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    random.seed(args.seed)

    delete_all_history(args.ql_url)

    now = datetime.now(timezone.utc).replace(microsecond=0)
    # Exactly 24 hours of 30 second intervals => 2880 points
    points = 2880
    start = now - timedelta(seconds=30 * (points - 1))

    states = {}
    for room in ROOMS:
        center_code = next(m["code"] for m in MUSEUMS if m["id"] == room["museumId"])
        states[room["id"]] = init_state_for_center(room, center_code)

    batch = []

    print(f"[generate_history] Generando {points} puntos por sala ({len(ROOMS)} salas)...")
    current = start

    for i in range(points):
        ts_iso = current.isoformat()

        for room in ROOMS:
            rc = room["id"].split(":")[-1]
            museum_code = next(m["code"] for m in MUSEUMS if m["id"] == room["museumId"])

            st = states[room["id"]]
            update_state(room, museum_code, st, current)

            env_attrs = {
                "dateObserved": ts_iso,
                "temperature": round(st.temperature, 2),
                "relativeHumidity": round(st.humidity, 2),
                "co2": round(st.co2, 2),
                "illuminance": round(st.illuminance, 2),
                "atmosphericPressure": round(st.pressure, 2),
                "peopleCount": st.people
            }
            noise_attrs = {
                "dateObserved": ts_iso,
                "dateObservedFrom": ts_iso,
                "dateObservedTo": ts_iso,
                "LAeq": round(st.laeq, 2),
                "LAmax": round(st.lamax, 2),
                "LAS": round(st.las, 2)
            }
            crowd_attrs = {
                "dateObserved": ts_iso,
                "dateObservedFrom": ts_iso,
                "dateObservedTo": ts_iso,
                "peopleCount": st.people,
                "occupancy": round(st.occupancy, 3)
            }

            batch.append(ql_entity(f"urn:ngsi-ld:IndoorEnvironmentObserved:{rc}", "IndoorEnvironmentObserved", env_attrs, ts_iso))
            batch.append(ql_entity(f"urn:ngsi-ld:NoiseLevelObserved:{rc}", "NoiseLevelObserved", noise_attrs, ts_iso))
            batch.append(ql_entity(f"urn:ngsi-ld:CrowdFlowObserved:{rc}", "CrowdFlowObserved", crowd_attrs, ts_iso))

        if len(batch) >= 500:
            post_ql_batch(args.ql_url, batch)
            batch.clear()
            if i % 100 == 0:
                print(f"  {i}/{points} timesteps enviados...")

        current += timedelta(seconds=30)

    if batch:
        post_ql_batch(args.ql_url, batch)
        
    # Finally, push the last state to Orion via IoT Agent or Orion HTTP
    print("[generate_history] Sincronizando estado final con Orion...")
    for room in ROOMS:
        rc = room["id"].split(":")[-1]
        st = states[room["id"]]
        
        env_payload = {
            "temperature": {"type": "Property", "value": round(st.temperature, 2)},
            "relativeHumidity": {"type": "Property", "value": round(st.humidity, 2)},
            "co2": {"type": "Property", "value": round(st.co2, 2)},
            "illuminance": {"type": "Property", "value": round(st.illuminance, 2)},
            "atmosphericPressure": {"type": "Property", "value": round(st.pressure, 2)},
            "peopleCount": {"type": "Property", "value": st.people}
        }
        res = requests.patch(f"{args.orion_url}/entities/urn:ngsi-ld:IndoorEnvironmentObserved:{rc}/attrs", json=env_payload, headers={"Content-Type": "application/json"})
        
        noise_payload = {
            "LAeq": {"type": "Property", "value": round(st.laeq, 2)},
            "LAmax": {"type": "Property", "value": round(st.lamax, 2)},
            "LAS": {"type": "Property", "value": round(st.las, 2)}
        }
        requests.patch(f"{args.orion_url}/entities/urn:ngsi-ld:NoiseLevelObserved:{rc}/attrs", json=noise_payload, headers={"Content-Type": "application/json"})

    print("[generate_history] Finalizado. 24h generadas.")

if __name__ == "__main__":
    main()
