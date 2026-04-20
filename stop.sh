#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "Parando simulador MQTT..."
docker compose exec -T backend sh -lc "pkill -f simulator/mqtt_simulator.py || true" || true

echo "Bajando stack Docker..."
docker compose down

echo "AuraVault detenido"
