#!/usr/bin/env python3
"""Carga de datos estaticos en Orion NGSI-LD para AuraVault."""

from __future__ import annotations

import argparse
import math
from collections import defaultdict
from typing import Dict, Iterable, List

from catalog import (
    ARTWORKS,
    DEVICE_MODELS,
    MUSEUMS,
    NGSI_LD_CONTEXT,
    ORION_ENTITY_HEADERS,
    ROOMS,
    room_location,
)
from ngsi_utils import (
    bulk_upsert_orion,
    delete_entity_if_exists,
    get_entity,
    ngsi_geoproperty,
    ngsi_property,
    ngsi_relationship,
    now_iso,
)


def chunked(items: List[Dict], size: int = 120) -> Iterable[List[Dict]]:
    for idx in range(0, len(items), size):
        yield items[idx : idx + size]


def museum_entity(museum: Dict) -> Dict:
    ts = now_iso()
    return {
        "id": museum["id"],
        "type": "Museum",
        "name": ngsi_property(museum["name"]),
        "alternateName": ngsi_property(museum["alternateName"]),
        "description": ngsi_property(museum["description"]),
        "museumType": ngsi_property(museum["museumType"]),
        "address": ngsi_property(museum["address"]),
        "location": ngsi_geoproperty(museum["location"]),
        "image": ngsi_property(museum["image"]),
        "refSeeAlso": ngsi_property(museum["sourceUrl"]),
        "openingHoursSpecification": ngsi_property(
            {
                "monday": "closed",
                "tuesday": "10:00-19:00",
                "wednesday": "10:00-19:00",
                "thursday": "10:00-19:00",
                "friday": "10:00-20:00",
                "saturday": "10:00-20:00",
                "sunday": "10:00-14:00",
            }
        ),
        "dataProvider": ngsi_property("AuraVault import_data.py"),
        "dateCreated": ngsi_property(ts),
        "dateModified": ngsi_property(ts),
        "@context": [NGSI_LD_CONTEXT],
    }


def room_entity(room: Dict) -> Dict:
    ts = now_iso()
    return {
        "id": room["id"],
        "type": "Room",
        "name": ngsi_property(room["name"]),
        "description": ngsi_property(room["description"]),
        "floor": ngsi_property(room["floor"]),
        "area": ngsi_property(room["area"]),
        "capacity": ngsi_property(room["capacity"]),
        "roomType": ngsi_property(room["roomType"]),
        "status": ngsi_property("optimal"),
        "currentOccupancy": ngsi_property(0),
        "recommendedMaxOccupancy": ngsi_property(max(1, math.floor(room["capacity"] * 0.9))),
        "isLocatedIn": ngsi_relationship(room["museumId"]),
        "location": ngsi_geoproperty(room_location(room)),
        "dataProvider": ngsi_property("AuraVault import_data.py"),
        "dateCreated": ngsi_property(ts),
        "dateModified": ngsi_property(ts),
        "@context": [NGSI_LD_CONTEXT],
    }


def artwork_entity(artwork: Dict) -> Dict:
    ts = now_iso()
    return {
        "id": artwork["id"],
        "type": "Artwork",
        "name": ngsi_property(artwork["name"]),
        "artist": ngsi_property(artwork["artist"]),
        "year": ngsi_property(artwork["year"]),
        "material": ngsi_property(artwork["material"]),
        "technique": ngsi_property(artwork["technique"]),
        "origin": ngsi_property(artwork["origin"]),
        "image": ngsi_property(artwork["image"]),
        "source": ngsi_property(artwork["sourceUrl"]),
        "isExposedIn": ngsi_relationship(artwork["roomId"]),
        "conservationRequirements": ngsi_property(artwork["conservationRequirements"]),
        "degradationRisk": ngsi_property(0.12),
        "stressAccumulated": ngsi_property(0.08),
        "conditionStatus": ngsi_property("good"),
        "lastAssessmentDate": ngsi_property(ts),
        "dateCreated": ngsi_property(ts),
        "dateModified": ngsi_property(ts),
        "@context": [NGSI_LD_CONTEXT],
    }


def device_model_entity(model: Dict) -> Dict:
    ts = now_iso()
    return {
        "id": model["id"],
        "type": "DeviceModel",
        "name": ngsi_property(model["name"]),
        "manufacturerName": ngsi_property(model["manufacturerName"]),
        "brandName": ngsi_property(model["brandName"]),
        "modelName": ngsi_property(model["modelName"]),
        "category": ngsi_property(model["category"]),
        "deviceCategory": ngsi_property(model["deviceCategory"]),
        "controlledProperty": ngsi_property(model["controlledProperty"]),
        "supportedUnits": ngsi_property(model["supportedUnits"]),
        "supportedProtocol": ngsi_property(model["supportedProtocol"]),
        "documentation": ngsi_property(model["documentation"]),
        "dateCreated": ngsi_property(ts),
        "dateModified": ngsi_property(ts),
        "@context": [NGSI_LD_CONTEXT],
    }


def build_room_devices(room: Dict) -> List[Dict]:
    room_loc = room_location(room)
    room_code = room["id"].split(":")[-1]
    ts = now_iso()

    definitions = [
        ("env", "urn:ngsi-ld:DeviceModel:env-th-sensor-v1", ["temperature", "relativeHumidity", "illuminance"]),
        ("co2", "urn:ngsi-ld:DeviceModel:co2-sensor-v2", ["co2", "temperature"]),
        ("noise", "urn:ngsi-ld:DeviceModel:sound-meter-v1", ["LAeq", "LAmax", "LAS"]),
        ("crowd", "urn:ngsi-ld:DeviceModel:crowd-sensor-v3", ["peopleCount", "occupancy", "direction"]),
        ("ctrl", "urn:ngsi-ld:DeviceModel:hvac-controller-v1", ["temperature", "co2", "relativeHumidity"]),
    ]

    entities: List[Dict] = []
    for suffix, model_id, controlled in definitions:
        device_id = f"urn:ngsi-ld:Device:{room_code}-{suffix}-01"
        entities.append(
            {
                "id": device_id,
                "type": "Device",
                "name": ngsi_property(f"{room['name']} {suffix.upper()} sensor"),
                "description": ngsi_property(f"Dispositivo {suffix} en {room['name']}"),
                "category": ngsi_property("sensor" if suffix != "ctrl" else "actuator-controller"),
                "deviceCategory": ngsi_property(suffix),
                "controlledProperty": ngsi_property(controlled),
                "deviceState": ngsi_property("on"),
                "value": ngsi_property(0),
                "batteryLevel": ngsi_property(0.98),
                "rssi": ngsi_property(-57),
                "latencyMs": ngsi_property(120),
                "serialNumber": ngsi_property(f"AUR-{room_code.upper()}-{suffix.upper()}-01"),
                "refDeviceModel": ngsi_relationship(model_id),
                "controlledAsset": ngsi_relationship(room["id"]),
                "location": ngsi_geoproperty(room_loc),
                "supportedProtocol": ngsi_property(["MQTT"]),
                "dateInstalled": ngsi_property(ts),
                "dateLastValueReported": ngsi_property(ts),
                "dateObserved": ngsi_property(ts),
                "dateCreated": ngsi_property(ts),
                "dateModified": ngsi_property(ts),
                "@context": [NGSI_LD_CONTEXT],
            }
        )
    return entities


def build_room_actuator(room: Dict) -> Dict:
    room_code = room["id"].split(":")[-1]
    ctrl_id = f"urn:ngsi-ld:Device:{room_code}-ctrl-01"
    actuator_type = "ventilation" if room["roomType"] == "performance" else "hvac"
    return {
        "id": f"urn:ngsi-ld:Actuator:{room_code}-act-01",
        "type": "Actuator",
        "name": ngsi_property(f"Actuador {room['name']}"),
        "description": ngsi_property("Actuador ambiental para regulacion de clima y calidad de aire."),
        "actuatorType": ngsi_property(actuator_type),
        "status": ngsi_property("off"),
        "targetProperty": ngsi_property(["temperature", "co2", "relativeHumidity"]),
        "commandSent": ngsi_property({"command": "none", "by": "system", "at": now_iso()}),
        "lastActivationDate": ngsi_property(now_iso()),
        "isLocatedIn": ngsi_relationship(room["id"]),
        "isControlledBy": ngsi_relationship(ctrl_id),
        "location": ngsi_geoproperty(room_location(room)),
        "dataProvider": ngsi_property("AuraVault import_data.py"),
        "dateCreated": ngsi_property(now_iso()),
        "dateModified": ngsi_property(now_iso()),
        "@context": [NGSI_LD_CONTEXT],
    }


def baseline_observations(room: Dict) -> List[Dict]:
    room_code = room["id"].split(":")[-1]
    location = room_location(room)
    now = now_iso()
    people = 8 if room["roomType"] == "exhibition" else 18

    env = {
        "id": f"urn:ngsi-ld:IndoorEnvironmentObserved:{room_code}",
        "type": "IndoorEnvironmentObserved",
        "name": ngsi_property(f"Indoor environment {room['name']}"),
        "location": ngsi_geoproperty(location),
        "dateObserved": ngsi_property(now),
        "refDevice": ngsi_relationship(f"urn:ngsi-ld:Device:{room_code}-env-01"),
        "refPointOfInterest": ngsi_relationship(room["id"]),
        "sensorPlacement": ngsi_property("center"),
        "sensorHeight": ngsi_property(2.1),
        "peopleCount": ngsi_property(people),
        "temperature": ngsi_property(21.0),
        "relativeHumidity": ngsi_property(49.0),
        "atmosphericPressure": ngsi_property(1014.0),
        "illuminance": ngsi_property(140.0),
        "co2": ngsi_property(760.0),
        "dataProvider": ngsi_property("AuraVault import_data.py"),
        "dateCreated": ngsi_property(now),
        "dateModified": ngsi_property(now),
        "@context": [NGSI_LD_CONTEXT],
    }

    noise = {
        "id": f"urn:ngsi-ld:NoiseLevelObserved:{room_code}",
        "type": "NoiseLevelObserved",
        "name": ngsi_property(f"Noise level {room['name']}"),
        "location": ngsi_geoproperty(location),
        "dateObservedFrom": ngsi_property(now),
        "dateObservedTo": ngsi_property(now),
        "dateObserved": ngsi_property(now),
        "refDevice": ngsi_relationship(f"urn:ngsi-ld:Device:{room_code}-noise-01"),
        "refPointOfInterest": ngsi_relationship(room["id"]),
        "LAS": ngsi_property(53.0 if room["roomType"] == "performance" else 48.0),
        "LAeq": ngsi_property(51.0 if room["roomType"] == "performance" else 45.0),
        "LAeq_d": ngsi_property(49.0 if room["roomType"] == "performance" else 44.0),
        "LAmax": ngsi_property(66.0 if room["roomType"] == "performance" else 58.0),
        "sonometerClass": ngsi_property("1"),
        "dataProvider": ngsi_property("AuraVault import_data.py"),
        "dateCreated": ngsi_property(now),
        "dateModified": ngsi_property(now),
        "@context": [NGSI_LD_CONTEXT],
    }

    crowd = {
        "id": f"urn:ngsi-ld:CrowdFlowObserved:{room_code}",
        "type": "CrowdFlowObserved",
        "name": ngsi_property(f"Crowd flow {room['name']}"),
        "location": ngsi_geoproperty(location),
        "dateObserved": ngsi_property(now),
        "dateObservedFrom": ngsi_property(now),
        "dateObservedTo": ngsi_property(now),
        "refDevice": ngsi_relationship(f"urn:ngsi-ld:Device:{room_code}-crowd-01"),
        "refRoadSegment": ngsi_relationship(room["id"]),
        "peopleCount": ngsi_property(people),
        "peopleCountTowards": ngsi_property(max(0, people // 2)),
        "peopleCountAway": ngsi_property(max(0, people // 3)),
        "occupancy": ngsi_property(round(min(1.0, people / room["capacity"]), 3)),
        "averageCrowdSpeed": ngsi_property(1.1),
        "averageHeadwayTime": ngsi_property(2.8),
        "congested": ngsi_property(False),
        "direction": ngsi_property("inbound"),
        "dataProvider": ngsi_property("AuraVault import_data.py"),
        "dateCreated": ngsi_property(now),
        "dateModified": ngsi_property(now),
        "@context": [NGSI_LD_CONTEXT],
    }
    return [env, noise, crowd]


def build_all_entities() -> List[Dict]:
    entities: List[Dict] = []

    entities.extend(museum_entity(m) for m in MUSEUMS)
    entities.extend(room_entity(r) for r in ROOMS)
    entities.extend(artwork_entity(a) for a in ARTWORKS)
    entities.extend(device_model_entity(m) for m in DEVICE_MODELS)

    for room in ROOMS:
        entities.extend(build_room_devices(room))
        entities.append(build_room_actuator(room))
        entities.extend(baseline_observations(room))

    return entities


def validate_references():
    room_ids = {room["id"] for room in ROOMS}
    museum_ids = {museum["id"] for museum in MUSEUMS}

    for room in ROOMS:
        if room["museumId"] not in museum_ids:
            raise ValueError(f"Room {room['id']} references unknown museum {room['museumId']}")

    for artwork in ARTWORKS:
        if artwork["roomId"] not in room_ids:
            raise ValueError(f"Artwork {artwork['id']} references unknown room {artwork['roomId']}")


def reset_entities(orion_url: str):
    # El reset borra IDs conocidos y evita afectar datos ajenos.
    ids: List[str] = []
    ids.extend(m["id"] for m in MUSEUMS)
    ids.extend(r["id"] for r in ROOMS)
    ids.extend(a["id"] for a in ARTWORKS)
    ids.extend(m["id"] for m in DEVICE_MODELS)

    for room in ROOMS:
        room_code = room["id"].split(":")[-1]
        ids.extend(
            [
                f"urn:ngsi-ld:Device:{room_code}-env-01",
                f"urn:ngsi-ld:Device:{room_code}-co2-01",
                f"urn:ngsi-ld:Device:{room_code}-noise-01",
                f"urn:ngsi-ld:Device:{room_code}-crowd-01",
                f"urn:ngsi-ld:Device:{room_code}-ctrl-01",
                f"urn:ngsi-ld:Actuator:{room_code}-act-01",
                f"urn:ngsi-ld:IndoorEnvironmentObserved:{room_code}",
                f"urn:ngsi-ld:NoiseLevelObserved:{room_code}",
                f"urn:ngsi-ld:CrowdFlowObserved:{room_code}",
            ]
        )

    for entity_id in ids:
        delete_entity_if_exists(orion_url, ORION_ENTITY_HEADERS, entity_id)


def print_summary():
    artwork_by_center = defaultdict(int)
    room_by_center = defaultdict(int)
    for room in ROOMS:
        room_by_center[room["museumId"]] += 1
    for artwork in ARTWORKS:
        target_room = next(r for r in ROOMS if r["id"] == artwork["roomId"])
        artwork_by_center[target_room["museumId"]] += 1

    print("\nResumen de carga:")
    for museum in MUSEUMS:
        mid = museum["id"]
        print(
            f"- {museum['name']}: {room_by_center[mid]} salas, {artwork_by_center[mid]} obras"
        )
    print(f"- DeviceModel: {len(DEVICE_MODELS)}")
    print(f"- Obras totales: {len(ARTWORKS)}")


def ensure_orion(orion_url: str):
    # Comprobacion rapida para avisar temprano.
    probe = f"{orion_url.rstrip('/')}/entities"
    get_entity(orion_url, ORION_ENTITY_HEADERS, "urn:ngsi-ld:Museum:muncyt-coruna") if False else None
    import requests

    resp = requests.get(probe, headers=ORION_ENTITY_HEADERS, timeout=15)
    if resp.status_code not in (200, 204):
        raise RuntimeError(f"Orion no disponible: {resp.status_code} {resp.text[:300]}")


def main():
    parser = argparse.ArgumentParser(description="Importa datos estaticos en Orion NGSI-LD")
    parser.add_argument("--orion-url", default="http://localhost:1026/ngsi-ld/v1")
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    validate_references()
    ensure_orion(args.orion_url)

    if args.reset:
        print("[import_data] Eliminando entidades previas conocidas...")
        reset_entities(args.orion_url)

    entities = build_all_entities()

    print(f"[import_data] Upsert de {len(entities)} entidades...")
    for block in chunked(entities, 90):
        bulk_upsert_orion(args.orion_url, ORION_ENTITY_HEADERS, block)

    print_summary()
    print("[import_data] Carga completada.")


if __name__ == "__main__":
    main()
