# AuraVault MVP (Fase 1 + Fase 2)

MVP completo de inteligencia ambiental para espacios culturales de interior sobre FIWARE (NGSI-LD), con backend Flask, frontend 7 vistas, simulacion IoT MQTT, historicos en QuantumLeap/CrateDB y dashboards Grafana provisionados.

## 1. Componentes del stack

- Orion-LD + MongoDB: contexto actual NGSI-LD.
- IoT Agent JSON + Mosquitto: ingestion IoT por MQTT.
- QuantumLeap + CrateDB: historico temporal.
- Backend Flask + SocketIO: API REST, reglas de negocio, ML, websocket y UI.
- Grafana: visualizacion historica provisionada por archivo.
- Ollama (opcional): soporte de chatbot local.

## 2. Estructura principal

- `backend/app.py`: servidor Flask + rutas UI/API + `/notify` + modelos ML.
- `scripts/import_data.py`: carga estatica NGSI-LD (centros, salas, obras, dispositivos, actuadores).
- `scripts/generate_history.py`: semilla de historico (30 dias, 5 min).
- `scripts/provision_iot_agent.py`: provision del IoT Agent (service group + devices).
- `scripts/create_subscriptions.py`: suscripciones Orion -> QuantumLeap y Orion -> backend `/notify`.
- `simulator/mqtt_simulator.py`: simulador realtime MQTT cada 30 segundos.
- `docker-compose.yml`: orquestacion completa.
- `start.sh` / `stop.sh`: arranque y parada del entorno.
- `grafana/provisioning/**` + `grafana/dashboards/**`: datasource + dashboard inicial.

## 3. Requisitos

- Docker >= 24
- Docker Compose plugin >= 2.20
- 6 GB RAM recomendados (por CrateDB + Grafana + Ollama)

## 4. Arranque rapido

Desde la raiz del repo:

```bash
./start.sh
```

El script realiza:

1. `docker compose up -d --build`
2. Espera de salud de todos los servicios
3. Provision del IoT Agent
4. Import de datos base NGSI-LD en Orion
5. Creacion de suscripciones Orion
6. Generacion de historico en QuantumLeap
7. Arranque del simulador MQTT en background

### URLs principales

- Aplicacion web: [http://localhost:5000](http://localhost:5000)
- Dashboard global: [http://localhost:5000/](http://localhost:5000/)
- Centros: [http://localhost:5000/centers](http://localhost:5000/centers)
- Centro de control: [http://localhost:5000/control](http://localhost:5000/control)
- Modo visitante (ejemplo): [http://localhost:5000/visitor/urn:ngsi-ld:Museum:muncyt](http://localhost:5000/visitor/urn:ngsi-ld:Museum:muncyt)
- Orion-LD: [http://localhost:1026](http://localhost:1026)
- QuantumLeap: [http://localhost:8668](http://localhost:8668)
- Grafana: [http://localhost:3000](http://localhost:3000) (admin/admin)

## 5. Parada

```bash
./stop.sh
```

## 6. Frontend implementado (7 vistas)

1. `dashboard.html`: KPIs globales, mapa, alertas y modelo.
2. `centers.html`: catalogo de centros con filtros.
3. `center_detail.html`: gauges, historico, actuadores, salas y obras en riesgo.
4. `twin3d.html`: gemelo digital 3D con Three.js.
5. `room_artwork.html`: detalle de sala, radar, historico y comparador de obras.
6. `control_center.html`: tabs de alertas, dispositivos y Grafana embebido.
7. `visitor.html`: modo publico simplificado y chat.

## 7. APIs clave

- `GET /api/dashboard/summary`
- `GET /api/model/graph`
- `GET /api/centers`
- `GET /api/centers/<center_id>/snapshot`
- `GET /api/centers/<center_id>/history`
- `GET /api/rooms/<room_id>`
- `GET /api/rooms/<room_id>/history`
- `POST /api/actuators/<actuator_id>/command`
- `POST /notify`

## 8. Datos reales utilizados

Los catalogos incluyen centros, salas y obras con metadatos reales y enlaces de imagen accesibles en abierto.
La normalizacion de catalogo se concentra en `scripts/catalog.py` para mantener coherencia entre importador, backend e IoT simulator.

## 9. Grafana provisioning

Se provisiona automaticamente:

- Data source: `AuraVault-CrateDB` (PostgreSQL wire protocol sobre CrateDB).
- Dashboard: `AuraVault Overview` (`uid: auravault-overview`).

Rutas de provisioning:

- `grafana/provisioning/datasources/datasource.yml`
- `grafana/provisioning/dashboards/dashboards.yml`
- `grafana/dashboards/auravault_overview.json`

## 10. Validacion recomendada (smoke test)

Tras levantar el stack:

```bash
curl -s http://localhost:5000/api/model/graph | jq .
curl -s http://localhost:5000/api/dashboard/summary | jq .kpis
curl -s http://localhost:1026/version
curl -s http://localhost:8668/version
curl -s http://localhost:3000/api/health
```

## 11. Notas operativas

- El pull del modelo de Ollama es opcional. Si falla, el backend mantiene respuestas fallback del asistente.
- `start.sh` es idempotente para entorno de desarrollo: reimporta datos con `--reset` y reactiva simulador.
- Si se modifica el dashboard de Grafana desde UI, los archivos de provisioning no se sobreescriben automaticamente.

## 12. Troubleshooting rapido

- Si IoT Agent no aparece healthy: revisar logs de `auravault-iot-agent` y conectividad con Orion/Mosquitto.
- Si no hay historico en charts: revisar `auravault-quantumleap` y que `scripts/create_subscriptions.py` se haya ejecutado.
- Si el chat local tarda: comprobar `auravault-ollama` y disponibilidad del modelo `gemma3:latest`.
