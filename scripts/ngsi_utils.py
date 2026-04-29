"""Utilidades NGSI-LD para Orion y QuantumLeap."""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional

import requests


DEFAULT_TIMEOUT = 60


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ngsi_property(value):
    return {"type": "Property", "value": value}


def ngsi_relationship(object_id: str):
    return {"type": "Relationship", "object": object_id}


def ngsi_geoproperty(geo_value: Dict):
    return {"type": "GeoProperty", "value": geo_value}


def request_json(
    method: str,
    url: str,
    headers: Optional[Dict] = None,
    params: Optional[Dict] = None,
    payload: Optional[Dict] = None,
    timeout: int = DEFAULT_TIMEOUT,
):
    final_headers = (headers or {}).copy()
    if method.upper() in ("POST", "PATCH", "PUT") and payload is not None:
        # Para escritura con @context en el body → ld+json sin Link
        final_headers["Content-Type"] = "application/ld+json"
        final_headers.pop("Link", None)
    elif method.upper() == "GET":
        # Para lecturas usamos application/json puro — sin Link header —
        # así Orion-LD responde con JSON compacto que se parsea directamente.
        final_headers["Accept"] = "application/json"
        final_headers.pop("Link", None)

    response = requests.request(
        method=method,
        url=url,
        headers=final_headers,
        params=params,
        data=json.dumps(payload) if payload is not None else None,
        timeout=timeout,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"HTTP {response.status_code} {url}: {response.text[:600]}")
    if not response.text.strip():
        return None
    content_type = response.headers.get("Content-Type", "")
    if "application/json" in content_type or "application/ld+json" in content_type:
        return response.json()
    return response.text


def retry(operation, retries: int = 3, sleep_seconds: float = 1.5):
    last_error = None
    for _ in range(retries):
        try:
            return operation()
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(sleep_seconds)
    raise last_error


def bulk_upsert_orion(orion_url: str, headers: Dict, entities: Iterable[Dict]):
    payload = list(entities)
    endpoint = f"{orion_url.rstrip('/')}/entityOperations/upsert"
    return retry(lambda: request_json("POST", endpoint, headers=headers, payload=payload))


def delete_entity_if_exists(orion_url: str, headers: Dict, entity_id: str):
    endpoint = f"{orion_url.rstrip('/')}/entities/{entity_id}"
    response = requests.delete(endpoint, headers=headers, timeout=DEFAULT_TIMEOUT)
    if response.status_code in (200, 204, 404):
        return
    raise RuntimeError(f"Delete failed for {entity_id}: {response.status_code} {response.text[:500]}")


def patch_entity_attrs(orion_url: str, headers: Dict, entity_id: str, attrs: Dict):
    endpoint = f"{orion_url.rstrip('/')}/entities/{entity_id}/attrs"
    return retry(lambda: request_json("PATCH", endpoint, headers=headers, payload=attrs))


def list_entities(
    orion_url: str,
    headers: Dict,
    entity_type: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 1000,
):
    endpoint = f"{orion_url.rstrip('/')}/entities"
    params = {"limit": limit}
    if entity_type:
        params["type"] = entity_type
    if q:
        params["q"] = q
    return retry(lambda: request_json("GET", endpoint, headers=headers, params=params)) or []


def get_entity(orion_url: str, headers: Dict, entity_id: str):
    endpoint = f"{orion_url.rstrip('/')}/entities/{entity_id}"
    return retry(lambda: request_json("GET", endpoint, headers=headers))


def plain_value(attr):
    if isinstance(attr, list) and len(attr) > 0:
        attr = attr[0]
    if isinstance(attr, dict) and "value" in attr:
        return attr["value"]
    if isinstance(attr, dict) and "object" in attr:
        return attr["object"]
    return attr


def normalize_entity(entity: Dict) -> Dict:
    out = {"id": entity.get("id"), "type": entity.get("type")}
    for key, value in entity.items():
        if key in ("id", "type", "@context"):
            continue
        out[key] = plain_value(value)
    return out


def post_iot_agent(iot_agent_url: str, payload: Dict):
    endpoint = f"{iot_agent_url.rstrip('/')}/iot/devices"
    headers = {"Content-Type": "application/json", "Fiware-Service": "openiot", "Fiware-ServicePath": "/"}
    return request_json("POST", endpoint, headers=headers, payload=payload)


def create_iot_service_group(iot_agent_url: str, payload: Dict):
    endpoint = f"{iot_agent_url.rstrip('/')}/iot/services"
    headers = {"Content-Type": "application/json", "Fiware-Service": "openiot", "Fiware-ServicePath": "/"}
    response = requests.post(endpoint, headers=headers, data=json.dumps(payload), timeout=DEFAULT_TIMEOUT)
    if response.status_code in (201, 204, 409):
        return
    raise RuntimeError(f"IoT service group failed: {response.status_code} {response.text[:400]}")


def create_orion_subscription(orion_url: str, headers: Dict, subscription_payload: Dict):
    endpoint = f"{orion_url.rstrip('/')}/subscriptions"
    response = requests.post(endpoint, headers=headers, data=json.dumps(subscription_payload), timeout=DEFAULT_TIMEOUT)
    if response.status_code in (201, 409):
        return response.headers.get("Location")
    if response.status_code == 422 and "Already Exists" in response.text:
        return None
    raise RuntimeError(f"Subscription failed: {response.status_code} {response.text[:600]}")


def query_quantumleap_series(ql_url: str, entity_id: str, attrs: List[str], last_n: int = 200):
    series = {}
    for attr in attrs:
        endpoint = f"{ql_url.rstrip('/')}/v2/entities/{entity_id}/attrs/{attr}"
        try:
            data = request_json("GET", endpoint, params={"lastN": last_n})
            values = data.get("values", []) if isinstance(data, dict) else []
            series[attr] = values
        except Exception:  # noqa: BLE001
            series[attr] = []
    return series
