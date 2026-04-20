#!/usr/bin/env python3
"""Crea suscripciones Orion para QuantumLeap y backend /notify."""

from __future__ import annotations

import argparse
import json
from typing import Dict, List

import requests

from catalog import NGSI_LD_CONTEXT, ORION_ENTITY_HEADERS


def build_headers() -> Dict[str, str]:
    return {
        "Accept": "application/ld+json",
        "Content-Type": "application/ld+json",
        "Link": f'<{NGSI_LD_CONTEXT}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"',
    }


def list_subscriptions(orion_url: str, headers: Dict[str, str]) -> List[Dict]:
    endpoint = f"{orion_url.rstrip('/')}/subscriptions"
    response = requests.get(endpoint, headers=headers, timeout=20)
    if response.status_code != 200:
        raise RuntimeError(f"No se pudieron listar suscripciones: {response.status_code} {response.text[:500]}")
    return response.json()


def create_subscription(orion_url: str, headers: Dict[str, str], payload: Dict):
    endpoint = f"{orion_url.rstrip('/')}/subscriptions"
    response = requests.post(endpoint, headers=headers, data=json.dumps(payload), timeout=20)
    if response.status_code in (201, 204):
        return
    if response.status_code == 409:
        return
    raise RuntimeError(f"Error creando suscripcion: {response.status_code} {response.text[:700]}")


def ensure_subscription(orion_url: str, headers: Dict[str, str], payload: Dict):
    existing = list_subscriptions(orion_url, headers)
    names = {sub.get("name", {}).get("value") for sub in existing if isinstance(sub.get("name"), dict)}
    if payload["name"]["value"] in names:
        print(f"[subscriptions] Ya existe: {payload['name']['value']}")
        return
    create_subscription(orion_url, headers, payload)
    print(f"[subscriptions] Creada: {payload['name']['value']}")


def ql_subscription(ql_url: str) -> Dict:
    return {
        "id": "urn:ngsi-ld:Subscription:auravault-ql-history",
        "type": "Subscription",
        "name": {"type": "Property", "value": "auravault-ql-history"},
        "description": {
            "type": "Property",
            "value": "Persistencia historica en QuantumLeap para observaciones y estado de dispositivos",
        },
        "entities": [
            {"type": "IndoorEnvironmentObserved"},
            {"type": "NoiseLevelObserved"},
            {"type": "CrowdFlowObserved"},
            {"type": "Device"},
        ],
        "notification": {
            "attributes": [
                "dateObserved",
                "temperature",
                "relativeHumidity",
                "co2",
                "illuminance",
                "LAeq",
                "LAmax",
                "LAS",
                "peopleCount",
                "occupancy",
                "deviceState",
                "batteryLevel",
                "latencyMs",
            ],
            "format": "normalized",
            "endpoint": {
                "uri": ql_url.rstrip("/") + "/v2/notify",
                "accept": "application/json",
            },
        },
        "isActive": {"type": "Property", "value": True},
        "@context": [NGSI_LD_CONTEXT],
    }


def backend_subscription(backend_notify_url: str) -> Dict:
    return {
        "id": "urn:ngsi-ld:Subscription:auravault-backend-notify",
        "type": "Subscription",
        "name": {"type": "Property", "value": "auravault-backend-notify"},
        "description": {
            "type": "Property",
            "value": "Envio de eventos de Orion al backend Flask para WebSocket y reglas de negocio",
        },
        "entities": [
            {"type": "IndoorEnvironmentObserved"},
            {"type": "NoiseLevelObserved"},
            {"type": "CrowdFlowObserved"},
            {"type": "Alert"},
            {"type": "Actuator"},
            {"type": "Device"},
            {"type": "Artwork"},
        ],
        "notification": {
            "format": "normalized",
            "endpoint": {
                "uri": backend_notify_url,
                "accept": "application/json",
            },
        },
        "isActive": {"type": "Property", "value": True},
        "@context": [NGSI_LD_CONTEXT],
    }


def main():
    parser = argparse.ArgumentParser(description="Crear suscripciones Orion")
    parser.add_argument("--orion-url", default="http://localhost:1026/ngsi-ld/v1")
    parser.add_argument("--ql-url", default="http://quantumleap:8668")
    parser.add_argument("--backend-notify-url", default="http://backend:5000/notify")
    args = parser.parse_args()

    headers = build_headers()

    ensure_subscription(args.orion_url, headers, ql_subscription(args.ql_url))
    ensure_subscription(args.orion_url, headers, backend_subscription(args.backend_notify_url))


if __name__ == "__main__":
    main()
