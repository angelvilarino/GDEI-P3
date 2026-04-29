#!/usr/bin/env python3
"""Simulador IoT MQTT en tiempo real para AuraVault.

Publica cada 30 segundos por sala:
- auravault/<centro>/<sala>/environment
- auravault/<centro>/<sala>/noise
- auravault/<centro>/<sala>/crowd
- auravault/<centro>/<sala>/device/<id>/state
- auravault/<centro>/<sala>/actuator/<id>/state
"""

from __future__ import annotations

import argparse
import json
import math
import random
import signal
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict

import paho.mqtt.client as mqtt

import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))
import requests

from scripts.catalog import MUSEUMS, ROOMS
from scripts.ngsi_utils import normalize_entity


@dataclass
class SimState:
    temperature: float
    humidity: float
    co2: float
    illuminance: float
    pressure: float
    people: int
    laeq: float
    lamax: float
    las: float
    occupancy: float
    battery: float
    latency_ms: float
    rssi: float
    hvac_active: bool


RUNNING = True


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def room_code(room_id: str) -> str:
    return room_id.split(":")[-1]


def museum_code(museum_id: str) -> str:
    for museum in MUSEUMS:
        if museum["id"] == museum_id:
            return museum["code"]
    raise KeyError(museum_id)


def init_state(room: Dict) -> SimState:
    base_people = max(2, int(room["capacity"] * 0.12))
    return SimState(
        temperature=21.0,
        humidity=48.5,
        co2=690.0,
        illuminance=150.0,
        pressure=1013.0,
        people=base_people,
        laeq=45.0,
        lamax=56.0,
        las=47.0,
        occupancy=base_people / room["capacity"],
        battery=0.99,
        latency_ms=120.0,
        rssi=-59.0,
        hvac_active=False,
    )


def daily_people_target(room: Dict, center_code: str, now: datetime) -> int:
    hour = now.hour + now.minute / 60.0
    weekend = now.weekday() >= 5

    capacity = room["capacity"]
    room_type = room["roomType"]

    midday = math.exp(-((hour - 13.0) ** 2) / (2 * 2.2**2))
    evening = math.exp(-((hour - 20.2) ** 2) / (2 * 1.4**2))

    if room_type == "exhibition":
        ratio = 0.08 + 0.52 * midday
        if weekend:
            ratio *= 1.30
    elif room_type == "performance":
        ratio = 0.06 + 0.23 * midday + 0.52 * evening
        if center_code in {"rosalia", "opera"} and 19 <= hour <= 22.5:
            ratio += 0.16
        if weekend:
            ratio *= 1.18
    elif room_type == "lobby":
        ratio = 0.09 + 0.24 * midday + 0.34 * evening
    else:
        ratio = 0.05 + 0.09 * midday

    ratio = min(0.95, max(0.02, ratio))
    return int(round(capacity * ratio))


def update_state(room: Dict, center_code: str, state: SimState, now: datetime):
    # Ocupacion con ruido gaussiano y tendencia diaria.
    target_people = daily_people_target(room, center_code, now)
    step = (target_people - state.people) * 0.28 + random.gauss(0.0, max(1.5, room["capacity"] * 0.01))
    state.people = int(max(0, min(room["capacity"], round(state.people + step))))
    state.occupancy = round(min(1.0, state.people / max(1, room["capacity"])), 3)

    visitor_units = state.people / 10.0

    # HVAC activado por umbral de CO2.
    if state.co2 > 1000:
        state.hvac_active = True
    elif state.co2 < 820:
        state.hvac_active = False

    hvac_cooling = 0.55 if state.hvac_active else 0.0
    hvac_co2 = 130.0 if state.hvac_active else 0.0
    hvac_humidity = 0.7 if state.hvac_active else 0.0

    # Reglas fisicas solicitadas.
    temperature_target = 20.2 + 0.3 * visitor_units - hvac_cooling
    humidity_target = 50.0 - 0.8 * visitor_units + hvac_humidity
    co2_target = 500.0 + 45.0 * visitor_units - hvac_co2

    # Correlacion suave + ruido gaussiano entre publicaciones.
    state.temperature += (temperature_target - state.temperature) * 0.35 + random.gauss(0, 0.12)
    state.humidity += (humidity_target - state.humidity) * 0.35 + random.gauss(0, 0.25)
    state.co2 += (co2_target - state.co2) * 0.4 + random.gauss(0, 8.0)

    hour = now.hour + now.minute / 60.0
    if 9.5 <= hour <= 19.5:
        illum_target = 210.0 if room["roomType"] == "exhibition" else 165.0
    elif 19.5 < hour <= 23.0 and center_code in {"rosalia", "opera"}:
        illum_target = 130.0
    else:
        illum_target = 22.0
    state.illuminance += (illum_target - state.illuminance) * 0.25 + random.gauss(0, 5.0)

    performance_boost = 8.0 if center_code in {"rosalia", "opera"} and 19 <= hour <= 22.5 else 0.0
    laeq_target = 43.0 + (2.0 if state.people > 20 else 0.0) + performance_boost + 0.08 * state.people
    state.laeq += (laeq_target - state.laeq) * 0.35 + random.gauss(0, 0.9)
    state.lamax = state.laeq + 8.0 + random.gauss(0, 1.1)
    state.las = state.laeq + 2.2 + random.gauss(0, 0.7)

    state.pressure += random.gauss(0, 0.4)
    state.battery = max(0.02, state.battery - random.uniform(0.00008, 0.0002))
    state.latency_ms = max(40.0, 90.0 + random.gauss(0, 20) + (140.0 if state.battery < 0.2 else 0.0))
    state.rssi = max(-90.0, min(-35.0, state.rssi + random.gauss(0, 1.3)))

    # Limites fisicos.
    state.temperature = max(14.0, min(31.0, state.temperature))
    state.humidity = max(20.0, min(85.0, state.humidity))
    state.co2 = max(390.0, min(3500.0, state.co2))
    state.illuminance = max(5.0, min(700.0, state.illuminance))
    state.laeq = max(30.0, min(100.0, state.laeq))
    state.lamax = max(state.laeq + 2.0, min(115.0, state.lamax))
    state.las = max(32.0, min(103.0, state.las))


def poll_actuator_state(orion_url: str, actuator_id: str) -> str:
    try:
        headers = {
            "Accept": "application/ld+json",
            "Content-Type": "application/ld+json",
            "Link": '<https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"',
        }
        response = requests.get(f"{orion_url.rstrip('/')}/entities/{actuator_id}", headers=headers, timeout=4)
        if response.status_code != 200:
            return "off"
        parsed = normalize_entity(response.json())
        return str(parsed.get("status", "off"))
    except Exception:  # noqa: BLE001
        return "off"


def publish_room_payloads(
    client: mqtt.Client,
    room: Dict,
    center_code: str,
    state: SimState,
    actuator_status: str,
):
    rc = room_code(room["id"])
    now = utc_now()

    env_topic = f"auravault/{center_code}/{rc}/environment"
    noise_topic = f"auravault/{center_code}/{rc}/noise"
    crowd_topic = f"auravault/{center_code}/{rc}/crowd"

    env_payload = {
        "id": f"urn:ngsi-ld:IndoorEnvironmentObserved:{rc}",
        "roomId": room["id"],
        "dateObserved": now,
        "temperature": round(state.temperature, 2),
        "relativeHumidity": round(state.humidity, 2),
        "co2": round(state.co2, 2),
        "illuminance": round(state.illuminance, 2),
        "atmosphericPressure": round(state.pressure, 2),
        "peopleCount": state.people,
        "hvacActive": actuator_status in {"on", "running"},
    }
    client.publish(env_topic, json.dumps(env_payload), qos=1)

    noise_payload = {
        "id": f"urn:ngsi-ld:NoiseLevelObserved:{rc}",
        "roomId": room["id"],
        "dateObservedFrom": now,
        "dateObservedTo": now,
        "LAeq": round(state.laeq, 2),
        "LAmax": round(state.lamax, 2),
        "LAS": round(state.las, 2),
    }
    client.publish(noise_topic, json.dumps(noise_payload), qos=1)

    crowd_payload = {
        "id": f"urn:ngsi-ld:CrowdFlowObserved:{rc}",
        "roomId": room["id"],
        "dateObserved": now,
        "peopleCount": state.people,
        "peopleCountTowards": max(0, int(state.people * 0.58)),
        "peopleCountAway": max(0, int(state.people * 0.32)),
        "occupancy": state.occupancy,
        "averageCrowdSpeed": round(max(0.2, 1.2 - state.occupancy * 0.7 + random.gauss(0, 0.05)), 2),
        "averageHeadwayTime": round(max(0.2, 3.0 - state.occupancy * 1.9 + random.gauss(0, 0.13)), 2),
        "congested": state.occupancy > 0.8,
        "direction": "inbound" if random.random() > 0.45 else "outbound",
    }
    client.publish(crowd_topic, json.dumps(crowd_payload), qos=1)

    for suffix in ["env", "co2", "noise", "crowd", "ctrl"]:
        device_id = f"urn:ngsi-ld:Device:{rc}-{suffix}-01"
        device_topic = f"auravault/{center_code}/{rc}/device/{device_id}/state"
        device_payload = {
            "id": device_id,
            "roomId": room["id"],
            "dateObserved": now,
            "deviceState": "fault" if state.battery < 0.05 else "on",
            "batteryLevel": round(state.battery, 3),
            "latencyMs": round(state.latency_ms, 1),
            "rssi": round(state.rssi, 1),
            "value": round(state.co2, 1) if suffix == "co2" else round(state.temperature, 2),
        }
        client.publish(device_topic, json.dumps(device_payload), qos=1)

    actuator_id = f"urn:ngsi-ld:Actuator:{rc}-act-01"
    actuator_topic = f"auravault/{center_code}/{rc}/actuator/{actuator_id}/state"
    actuator_payload = {
        "id": actuator_id,
        "roomId": room["id"],
        "status": actuator_status,
        "commandSent": {
            "command": "auto-cool" if state.co2 > 1000 else "idle",
            "at": now,
        },
        "lastActivationDate": now,
    }
    client.publish(actuator_topic, json.dumps(actuator_payload), qos=1)


def simulator_loop(args):
    states = {room["id"]: init_state(room) for room in ROOMS}
    actuator_cache: Dict[str, str] = {}

    client = mqtt.Client(client_id="auravault-simulator", clean_session=True)
    client.connect(args.mqtt_host, args.mqtt_port, keepalive=60)
    client.loop_start()

    cycle = 0
    while RUNNING:
        now = datetime.now(timezone.utc)
        cycle += 1

        for room in ROOMS:
            center_code = museum_code(room["museumId"])
            rc = room_code(room["id"])
            actuator_id = f"urn:ngsi-ld:Actuator:{rc}-act-01"

            # Poll ocasional para acoplar comando de actuador enviado desde backend.
            if cycle % max(1, args.actuator_poll_every) == 1:
                actuator_cache[actuator_id] = poll_actuator_state(args.orion_url, actuator_id)

            state = states[room["id"]]
            state.hvac_active = actuator_cache.get(actuator_id, "off") in {"on", "running"}
            update_state(room, center_code, state, now)
            publish_room_payloads(client, room, center_code, state, actuator_cache.get(actuator_id, "off"))

        time.sleep(args.interval)

    client.loop_stop()
    client.disconnect()


def handle_signal(signum, frame):  # noqa: ARG001
    global RUNNING
    RUNNING = False


def main():
    parser = argparse.ArgumentParser(description="Simulador MQTT AuraVault")
    parser.add_argument("--mqtt-host", default="localhost")
    parser.add_argument("--mqtt-port", type=int, default=1883)
    parser.add_argument("--orion-url", default="http://localhost:1026/ngsi-ld/v1")
    parser.add_argument("--interval", type=int, default=30)
    parser.add_argument("--actuator-poll-every", type=int, default=4)
    parser.add_argument("--seed", type=int, default=13)
    args = parser.parse_args()

    random.seed(args.seed)
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    simulator_loop(args)


if __name__ == "__main__":
    main()
