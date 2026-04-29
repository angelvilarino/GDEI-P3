#!/usr/bin/env python3
"""Provisiona IoT Agent JSON con service group y dispositivos AuraVault."""

from __future__ import annotations

import argparse
import json
from typing import Dict, Iterable, List

import requests

from catalog import MUSEUMS, ROOMS


def chunked(items: List[Dict], size: int = 25) -> Iterable[List[Dict]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def room_code(room_id: str) -> str:
    return room_id.split(":")[-1]


def museum_code(museum_id: str) -> str:
    for museum in MUSEUMS:
        if museum["id"] == museum_id:
            return museum["code"]
    raise KeyError(museum_id)


def iot_headers() -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Fiware-Service": "openiot",
        "Fiware-ServicePath": "/",
    }


def ensure_service_group(iot_agent_url: str, cbroker_url: str):
    endpoint = f"{iot_agent_url.rstrip('/')}/iot/services"
    payload = {
        "services": [
            {
                "apikey": "auravault",
                "cbroker": cbroker_url,
                "entity_type": "Thing",
                "resource": "/iot/json",
            }
        ]
    }
    response = requests.post(endpoint, headers=iot_headers(), data=json.dumps(payload), timeout=20)
    if response.status_code in (201, 204, 409):
        print("[iot-agent] Service group listo")
        return
    raise RuntimeError(f"Error creando service group: {response.status_code} {response.text[:500]}")


def build_device_payloads() -> List[Dict]:
    devices: List[Dict] = []

    for room in ROOMS:
        rc = room_code(room["id"])
        cc = museum_code(room["museumId"])

        devices.append(
            {
                "device_id": f"dev-{rc}-env",
                "entity_name": f"urn:ngsi-ld:IndoorEnvironmentObserved:{rc}",
                "entity_type": "IndoorEnvironmentObserved",
                "protocol": "PDI-IoTA-JSON",
                "transport": "MQTT",
                "topic": f"auravault/dev-{rc}-env/attrs",
                "attributes": [
                    {"object_id": "temperature", "name": "temperature", "type": "Number"},
                    {"object_id": "relativeHumidity", "name": "relativeHumidity", "type": "Number"},
                    {"object_id": "co2", "name": "co2", "type": "Number"},
                    {"object_id": "illuminance", "name": "illuminance", "type": "Number"},
                    {"object_id": "atmosphericPressure", "name": "atmosphericPressure", "type": "Number"},
                    {"object_id": "peopleCount", "name": "peopleCount", "type": "Number"},
                    {"object_id": "dateObserved", "name": "dateObserved", "type": "DateTime"},
                ],
                "static_attributes": [
                    {"name": "refPointOfInterest", "type": "Text", "value": room["id"]},
                    {"name": "refDevice", "type": "Text", "value": f"urn:ngsi-ld:Device:{rc}-env-01"},
                ],
            }
        )

        devices.append(
            {
                "device_id": f"dev-{rc}-noise",
                "entity_name": f"urn:ngsi-ld:NoiseLevelObserved:{rc}",
                "entity_type": "NoiseLevelObserved",
                "protocol": "PDI-IoTA-JSON",
                "transport": "MQTT",
                "topic": f"auravault/dev-{rc}-noise/attrs",
                "attributes": [
                    {"object_id": "LAeq", "name": "LAeq", "type": "Number"},
                    {"object_id": "LAmax", "name": "LAmax", "type": "Number"},
                    {"object_id": "LAS", "name": "LAS", "type": "Number"},
                    {"object_id": "dateObservedFrom", "name": "dateObservedFrom", "type": "DateTime"},
                    {"object_id": "dateObservedTo", "name": "dateObservedTo", "type": "DateTime"},
                ],
                "static_attributes": [
                    {"name": "refPointOfInterest", "type": "Text", "value": room["id"]},
                    {"name": "refDevice", "type": "Text", "value": f"urn:ngsi-ld:Device:{rc}-noise-01"},
                ],
            }
        )

        devices.append(
            {
                "device_id": f"dev-{rc}-crowd",
                "entity_name": f"urn:ngsi-ld:CrowdFlowObserved:{rc}",
                "entity_type": "CrowdFlowObserved",
                "protocol": "PDI-IoTA-JSON",
                "transport": "MQTT",
                "topic": f"auravault/dev-{rc}-crowd/attrs",
                "attributes": [
                    {"object_id": "peopleCount", "name": "peopleCount", "type": "Number"},
                    {"object_id": "peopleCountTowards", "name": "peopleCountTowards", "type": "Number"},
                    {"object_id": "peopleCountAway", "name": "peopleCountAway", "type": "Number"},
                    {"object_id": "occupancy", "name": "occupancy", "type": "Number"},
                    {"object_id": "averageCrowdSpeed", "name": "averageCrowdSpeed", "type": "Number"},
                    {"object_id": "averageHeadwayTime", "name": "averageHeadwayTime", "type": "Number"},
                    {"object_id": "congested", "name": "congested", "type": "Boolean"},
                    {"object_id": "direction", "name": "direction", "type": "Text"},
                    {"object_id": "dateObserved", "name": "dateObserved", "type": "DateTime"},
                ],
                "static_attributes": [
                    {"name": "refRoadSegment", "type": "Text", "value": room["id"]},
                    {"name": "refDevice", "type": "Text", "value": f"urn:ngsi-ld:Device:{rc}-crowd-01"},
                ],
            }
        )

        devices.append(
            {
                "device_id": f"dev-{rc}-act",
                "entity_name": f"urn:ngsi-ld:Actuator:{rc}-act-01",
                "entity_type": "Actuator",
                "protocol": "PDI-IoTA-JSON",
                "transport": "MQTT",
                "topic": f"auravault/dev-{rc}-act/attrs",
                "attributes": [
                    {"object_id": "status", "name": "status", "type": "Text"},
                    {"object_id": "commandSent", "name": "commandSent", "type": "StructuredValue"},
                    {"object_id": "lastActivationDate", "name": "lastActivationDate", "type": "DateTime"},
                ],
                "static_attributes": [
                    {"name": "isLocatedIn", "type": "Text", "value": room["id"]},
                    {"name": "isControlledBy", "type": "Text", "value": f"urn:ngsi-ld:Device:{rc}-ctrl-01"},
                ],
            }
        )

    return devices


def provision_devices(iot_agent_url: str, devices: List[Dict]):
    endpoint = f"{iot_agent_url.rstrip('/')}/iot/devices"
    headers = iot_headers()

    for group in chunked(devices, 15):
        payload = {"devices": group}
        response = requests.post(endpoint, headers=headers, data=json.dumps(payload), timeout=30)
        if response.status_code in (201, 204, 207, 409):
            continue
        raise RuntimeError(f"Error provisionando dispositivos: {response.status_code} {response.text[:600]}")


def main():
    parser = argparse.ArgumentParser(description="Provision IoT Agent")
    parser.add_argument("--iot-agent-url", default="http://localhost:4041")
    parser.add_argument("--cbroker-url", default="http://orion:1026")
    args = parser.parse_args()

    ensure_service_group(args.iot_agent_url, args.cbroker_url)
    devices = build_device_payloads()
    provision_devices(args.iot_agent_url, devices)
    print(f"[iot-agent] Dispositivos provisionados: {len(devices)}")


if __name__ == "__main__":
    main()
