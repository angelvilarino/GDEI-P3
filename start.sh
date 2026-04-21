#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

wait_for_health() {
  local container_name="$1"
  local retries="${2:-120}"
  local delay="${3:-3}"

  echo "[wait] $container_name"
  for ((i = 1; i <= retries; i++)); do
    local status
    status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null || true)"
    if [[ "$status" == "healthy" || "$status" == "running" ]]; then
      echo "[ok] $container_name ($status)"
      return 0
    fi
    sleep "$delay"
  done

  echo "[error] El contenedor $container_name no alcanzo estado healthy/running"
  docker compose ps
  return 1
}

echo "[1/7] Levantando stack base..."
docker compose up -d --build

echo "[2/7] Esperando servicios core..."
wait_for_health auravault-mongo
wait_for_health auravault-orion
wait_for_health auravault-mosquitto
wait_for_health auravault-iot-agent
wait_for_health auravault-cratedb
wait_for_health auravault-quantumleap
wait_for_health auravault-grafana
wait_for_health auravault-ollama
wait_for_health auravault-backend

echo "[3/7] Provision IoT Agent..."
docker compose exec -T backend python scripts/provision_iot_agent.py \
  --iot-agent-url http://iot-agent:4041 \
  --cbroker-url http://orion:1026

echo "[4/7] Importando datos base en Orion..."
docker compose exec -T backend python scripts/import_data.py \
  --orion-url http://orion:1026/ngsi-ld/v1 \
  --reset

echo "[5/7] Creando suscripciones Orion..."
docker compose exec -T backend python scripts/create_subscriptions.py \
  --orion-url http://orion:1026/ngsi-ld/v1 \
  --ql-url http://quantumleap:8668 \
  --backend-notify-url http://backend:5000/notify

echo "[6/7] Generando historico de 7 dias..."
docker compose exec -T backend python scripts/generate_history.py \
  --ql-url http://quantumleap:8668 \
  --orion-url http://orion:1026/ngsi-ld/v1 \
  --days 7 \
  --step-minutes 15

echo "[7/7] Arrancando simulador MQTT realtime..."
docker compose exec -T backend sh -lc "pkill -f simulator/mqtt_simulator.py || true"
docker compose exec -d backend python simulator/mqtt_simulator.py \
  --mqtt-host mosquitto \
  --mqtt-port 1883 \
  --orion-url http://orion:1026/ngsi-ld/v1 \
  --interval 30

# Carga opcional del modelo local para chatbot. Si falla, backend usa fallback deterministico.
docker compose exec -T llm-local ollama pull gemma3:latest || true

echo ""
echo "AuraVault listo"
echo "- Frontend/Backend: http://localhost:5000"
echo "- Grafana:          http://localhost:3000 (admin/admin)"
echo "- Orion-LD:         http://localhost:1026"
echo "- QuantumLeap:      http://localhost:8668"
