# AuraVault MVP — Consolidación Final

MVP de inteligencia ambiental para espacios culturales de interior sobre FIWARE (NGSI-LD), con backend Flask, frontend 8 vistas, simulacion IoT MQTT con alertas periodicas, historicos en QuantumLeap/CrateDB, dashboards Grafana provisionados e i18n ES/EN completo.

URL del repositorio: https://github.com/angelvilarino/GDEI-P3

## 1. Stack tecnologico

| Componente | Rol | Puerto |
|---|---|---|
| Orion-LD + MongoDB | Contexto actual NGSI-LD | 1026 / 27017 |
| IoT Agent JSON + Mosquitto | Ingestion IoT por MQTT | 4041/7896 / 1883 |
| QuantumLeap + CrateDB | Historico temporal | 8668 / 4200/5432 |
| Flask + SocketIO | API REST, ML, websocket, UI | 5000 |
| Grafana | Dashboards provisionados | 3000 |
| Gemini API | Chatbot AuraBot (visitante) | cloud |

## 2. Estructura del proyecto

```
backend/
  app.py              — servidor Flask + API + /notify + ML + SocketIO
  static/
    css/style.css
    js/common.js      — traducciones ES/EN, helpers globales
    js/dashboard.js   — dashboard global
    js/centers.js     — catalogo de centros
    js/center_detail.js
    js/room_artwork.js
    js/control_center.js
    js/chatbot.js     — AuraBot (modo visitante)
    js/visitor.js
    js/twin3d.js
    js/room_3d.js
    images/
      rooms/          — imagenes locales de salas (24 imagenes)
      artworks/       — imagenes locales de obras (9 imagenes)
  templates/          — 8 plantillas HTML con data-i18n completo
scripts/
  catalog.py          — datos maestros de centros, salas y obras
  import_data.py      — carga NGSI-LD en Orion
  provision_iot_agent.py
  create_subscriptions.py
  generate_history.py
simulator/
  mqtt_simulator.py   — simulador MQTT 30s con alertas periodicas forzadas
grafana/
  dashboards/
    auravault_overview.json
    auravault_control.json    — dashboard de control con 7 paneles
    auravault_center_detail.json
  provisioning/
    datasources/datasource.yml
    dashboards/dashboards.yml
docker-compose.yml
start.sh / stop.sh
```

## 3. Requisitos

- Docker >= 24
- Docker Compose plugin >= 2.20
- 6 GB RAM recomendados (por CrateDB + Grafana)
- Clave de API Gemini en `backend/gemini.key` (para chatbot visitante)

## 4. Arranque rapido

```bash
./start.sh
```

El script:
1. `docker compose up -d --build`
2. Espera de salud de todos los servicios
3. Provision del IoT Agent
4. Import de datos base NGSI-LD en Orion (salas e imagenes locales)
5. Creacion de suscripciones Orion → QuantumLeap y → backend `/notify`
6. Generacion de historico en QuantumLeap
7. Arranque del simulador MQTT en background

### URLs principales

| Servicio | URL |
|---|---|
| Aplicacion web | http://localhost:5000 |
| Dashboard global | http://localhost:5000/ |
| Centros | http://localhost:5000/centers |
| Control | http://localhost:5000/control |
| Modo visitante | http://localhost:5000/visitor/urn:ngsi-ld:Museum:muncyt-coruna |
| Orion-LD | http://localhost:1026 |
| QuantumLeap | http://localhost:8668 |
| Grafana | http://localhost:3000 (admin/admin) |
| CrateDB Admin | http://localhost:4200 |

## 5. Parada

```bash
./stop.sh
```

## 6. Frontend — 8 vistas

| Vista | Fichero | Descripcion |
|---|---|---|
| Dashboard global | `dashboard.html` | KPIs, mapa Leaflet, alertas, modelo de datos |
| Catalogo de centros | `centers.html` | Tarjetas con filtros y busqueda |
| Detalle de centro | `center_detail.html` | Gauges, historico, actuadores, alertas, salas |
| Detalle sala/obra | `room_artwork.html` | Radar ambiental, comparador obras, historico |
| Gemelo 3D centro | `twin3d.html` | Modelo Three.js de centro con colores IoT |
| Vista 3D sala | `room_3d.html` | Sala individual Three.js |
| Centro de control | `control_center.html` | Tabs: Alertas / Dispositivos / Grafana embed |
| Modo visitante | `visitor.html` | Vista simplificada + AuraBot (Gemini) |

## 7. Simulador IoT — comportamiento

El simulador publica datos cada 30 segundos para las 24 salas (4 centros × 6 salas). Cada ciclo incluye:
- Sensor ambiental: temperatura, humedad, CO2, iluminancia, presion
- Sensor de ruido: LAeq, LAmax, LAS
- Sensor de aforo: peopleCount, occupancy
- Estado de dispositivos y actuador HVAC

**Alertas forzadas periodicas:** cada 10 ciclos (~5 minutos), durante 3 ciclos consecutivos, la sala designada de cada centro genera una alerta alternando entre:
- Humedad fuera de rango (>65%) — ciclos pares
- CO2 elevado (>800 ppm) — ciclos impares

Salas designadas para alerta:
- MUNCYT → Sala Creador.es
- Bellas Artes → Sala de Ceramica de Sargadelos
- Rosalia → Patio de Butacas
- Opera → Auditorio Principal

## 8. Grafana — dashboards provisionados

### auravault_control.json (7 paneles)

| Panel | Tipo | Descripcion |
|---|---|---|
| Temperatura Promedio | stat | AVG temperatura en periodo |
| Humedad Promedio | stat | AVG humedad en periodo |
| Lecturas en Alerta | stat | COUNT lecturas con CO2>700 o humedad>65 o temp>26 |
| Mapa de Calor — Alertas | status-history | Frecuencia de alertas por centro/hora |
| Ranking CO2 | table | Top 5 salas por CO2 max/promedio |
| **Promedio de Humedad por Centro** | barchart | AVG humedad comparativa entre los 4 centros |
| **Evolución Critica CO2 (>800 ppm)** | timeseries | Lecturas de CO2 superiores a 800 ppm en 24h |

Todas las consultas usan `time_index` y la tabla `etindoorenvironmentobserved`.

## 9. Chatbot AuraBot

AuraBot es el asistente conversacional de AuraVault, disponible exclusivamente en Modo Visitante (`?mode=visitor`) desde las páginas de detalle de centro y detalle de sala.

**Base tecnológica**: AuraBot está impulsado por **Gemini API** de Google, concretamente el modelo `gemini-2.5-flash`, accedido como servicio cloud desde el backend Flask mediante peticiones HTTPS. La API key se almacena únicamente en el servidor (`backend/gemini.key`, excluido de git) y nunca se expone al frontend.

**Funcionamiento**:
1. El frontend construye `window.AURABOT_CONTEXT` con los datos ya cargados en pantalla (sala, obras, métricas ambientales en tiempo real) y lo envía junto con el historial de conversación a `POST /api/chat`.
2. Flask inyecta ese contexto en el system prompt de Gemini e incluye el idioma activo (`lang`) para que las respuestas respeten la preferencia de ES/EN del visitante.
3. Gemini genera una respuesta en lenguaje natural; Flask la retransmite al widget del frontend.
4. El historial persiste en `sessionStorage` (máx. 40 mensajes) mientras la pestaña esté abierta.

**Para activarlo**: añadir `backend/gemini.key` con una clave válida de Gemini API antes de arrancar el sistema.

## 10. i18n ES/EN

La aplicacion soporta cambio de idioma en tiempo real mediante el toggle de la Navbar. Al cambiar el idioma se despacha el evento DOM `aura:langchange`; todos los módulos JS escuchan este evento y re-renderizan sus componentes dinámicos (gráficas, radar, actuadores, paneles 3D, vista visitante) sin recargar la página.

Las traducciones se encuentran en el objeto `AURA.t` dentro de `backend/static/js/common.js` e incluyen:

- Métricas de sensores (temperatura, humedad, CO2, aforo, ruido)
- Estados de dispositivos y actuadores
- Categorías y severidades de alertas
- Etiquetas de gráficas (Chart.js) y ejes con formato de fecha localizado
- Niveles de riesgo y estado de conservación de obras
- Contenido de la vista visitante (calidad del aire, horarios, patrimonio)
- Textos del widget AuraBot (indicador "pensando", mensajes de error)
- Botones, placeholders, tooltips y opciones de filtros

**Las respuestas de AuraBot (Gemini) también respetan el idioma activo**: el frontend envía `lang` en cada petición al chatbot y el backend construye el system prompt en el idioma correspondiente.

## 11. APIs clave

```
GET  /api/dashboard/summary
GET  /api/model/graph
GET  /api/centers
GET  /api/centers/<id>/snapshot
GET  /api/centers/<id>/history
GET  /api/rooms/<id>
GET  /api/rooms/<id>/history
GET  /api/rooms/<id>/sensor-history
GET  /api/artworks/<id>/history
POST /api/actuators/<id>/command
POST /notify
GET  /api/socket/info
```

## 12. Imagenes locales

Todas las salas y obras clave usan imagenes locales servidas desde `/static/images/`:

- `static/images/rooms/` — 24 imagenes JPEG (una por sala)
- `static/images/artworks/` — 9 imagenes JPEG/JPG (obras con imagen especifica)

Las obras sin imagen local usan placeholders semanticos de Picsum Photos.

## 13. Smoke test

```bash
curl -s http://localhost:5000/api/model/graph | jq .
curl -s http://localhost:5000/api/dashboard/summary | jq .kpis
curl -s http://localhost:1026/version
curl -s http://localhost:8668/version
curl -s http://localhost:3000/api/health
# Verificar imagen local:
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/static/images/rooms/piezas_con_memoria.jpeg
```

## 14. Troubleshooting

- **Sin historico en graficas**: revisar `auravault-quantumleap` y que `create_subscriptions.py` se haya ejecutado.
- **IoT Agent no healthy**: revisar logs de `auravault-iot-agent` y conectividad con Orion/Mosquitto.
- **Chatbot no responde**: verificar clave Gemini en `backend/gemini.key`.
- **Imagenes no cargan**: confirmar que `backend/static/images/` tiene el contenido de `images/` (lo copia `start.sh`).
- **Grafana paneles en blanco**: asegurarse de que el simulador ha publicado datos y que QuantumLeap ha escrito en CrateDB.
