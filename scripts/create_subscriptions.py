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
        # "Link" removido para evitar conflicto con Content-Type: application/ld+json
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


def patch_subscription(orion_url: str, headers: Dict[str, str], subscription_id: str, payload: Dict):
    endpoint = f"{orion_url.rstrip('/')}/subscriptions/{subscription_id}"
    response = requests.patch(endpoint, headers=headers, data=json.dumps(payload), timeout=20)
    if response.status_code in (200, 204):
        return
    raise RuntimeError(f"Error actualizando suscripcion: {response.status_code} {response.text[:700]}")


def ensure_subscription(orion_url: str, headers: Dict[str, str], payload: Dict):
    existing = list_subscriptions(orion_url, headers)
    target_name = payload.get("name")
    target_id = payload.get("id")
    existing_by_name = {sub.get("name") or sub.get("subscriptionName"): sub for sub in existing if sub.get("name") or sub.get("subscriptionName")}
    existing_by_id = {sub.get("id"): sub for sub in existing if sub.get("id")}

    sub = None
    if target_name and target_name in existing_by_name:
        sub = existing_by_name[target_name]
    elif target_id and target_id in existing_by_id:
        sub = existing_by_id[target_id]

    if sub is not None:
        print(f"[subscriptions] Ya existe: {target_name or target_id}")
        if not sub.get("isActive", True) or sub.get("status") == "paused":
            update_payload = {"isActive": True}
            if payload.get("@context"):
                update_payload["@context"] = payload["@context"]
            patch_subscription(orion_url, headers, sub["id"], update_payload)
            print(f"[subscriptions] Activada: {sub['id']}")
        return

    create_subscription(orion_url, headers, payload)
    print(f"[subscriptions] Creada: {payload.get('name')}")


def ql_subscription(ql_url: str) -> Dict:
    return {
        "@context": NGSI_LD_CONTEXT,
        "id": "urn:ngsi-ld:Subscription:auravault-ql-history",
        "type": "Subscription",
        "name": "auravault-ql-history",
        "description": "Persistencia historica en QuantumLeap para observaciones y estado de dispositivos",
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
        "isActive": True,
    }


def backend_subscription(backend_notify_url: str) -> Dict:
    return {
        "@context": NGSI_LD_CONTEXT,
        "id": "urn:ngsi-ld:Subscription:auravault-backend-notify",
        "type": "Subscription",
        "name": "auravault-backend-notify",
        "description": "Envio de eventos de Orion al backend Flask para WebSocket y reglas de negocio",
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
        "isActive": True,
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
