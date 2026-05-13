# architecture — AuraVault

## 1. Objetivo de la arquitectura

Este documento define la arquitectura técnica de AuraVault para implementar una aplicación FIWARE de monitorización ambiental interior, conservación preventiva y soporte al visitante en tiempo real.

Se usa exclusivamente NGSI-LD, con Orion como fuente de estado actual, QuantumLeap y CrateDB para históricos, Flask como backend de orquestación y Flask-SocketIO para distribución de eventos en tiempo real al frontend.

## 2. Principios de diseño

- Interoperabilidad semántica mediante NGSI-LD en todas las entidades de negocio.
- Desacoplo entre ingestión IoT, almacenamiento contextual, analítica y presentación.
- Flujo event-driven con suscripciones Orion hacia `/notify`.
- Baja latencia de actualización visual mediante WebSocket.
- Separación entre APIs privadas de operación y APIs públicas de Visitante.
- Extensión de IA conversacional con Gemini API (cloud) para el rol Visitante.

## 3. Diagrama Mermaid de componentes y flujos

```mermaid
graph LR
  subgraph IOT[IoT y Simulación]
    SIM[Simulador MQTT\n(dispositivos virtuales)]
    MOS[ Mosquitto MQTT\n1883 ]
    IOTA[ IoT Agent JSON\n4041/7896 ]
  end

  subgraph FIWARE[Contexto y Persistencia]
    ORION[ Orion CB NGSI-LD\n1026 ]
    QL[ QuantumLeap\n8668 ]
    CRATE[ CrateDB\n4200/5432 ]
    MONGO[(MongoDB\n27017)]
  end

  subgraph APP[Capa de Aplicación]
    FLASK[ Flask + Flask-SocketIO\n5000 ]
    ML[ scikit-learn service\n(in-process backend) ]
    NOTIFY[/notify endpoint]
  end

  subgraph UX[Presentación]
    FRONT[Frontend Web\nDashboard/3D/Admin]
    VIS[Modo Visitante\n/visitor/<poi_id>]
    CHAT[Widget Chat Visitante]
  end

  subgraph LLM[Asistente IA Cloud]
    GEMINI[Gemini API\ngemini-2.5-flash]
  end

  SIM -->|publish MQTT each 30s| MOS
  MOS -->|telemetría| IOTA
  IOTA -->|NGSI-LD upsert| ORION
  ORION -->|context storage| MONGO
  ORION -->|subscription notifications| QL
  QL -->|time-series write| CRATE
  ORION -->|subscription callback| NOTIFY
  NOTIFY --> FLASK

  FLASK -->|REST queries/patches| ORION
  FLASK -->|historical queries| QL
  FLASK -->|model inference| ML
  ML -->|degradationRisk| FLASK
  FLASK -->|PATCH Artwork.degradationRisk| ORION

  FRONT -->|REST| FLASK
  VIS -->|REST| FLASK
  FLASK -->|WebSocket events| FRONT
  FLASK -->|WebSocket events| VIS

  CHAT -->|messages + window.AURABOT_CONTEXT| FLASK
  FLASK -->|generateContent API call| GEMINI
  GEMINI -->|natural language answer| FLASK
  FLASK -->|chat response| CHAT
```

## 4. Componentes: rol, puertos, imagen y dependencias

### 4.1 Mosquitto

- Rol: broker MQTT para telemetría y estado de dispositivos/actuadores.
- Imagen Docker: `eclipse-mosquitto:2`.
- Puertos: `1883` (MQTT), opcional `9001` (WebSocket MQTT).
- Dependencias: ninguna obligatoria, base de ingestión para IoT Agent.

### 4.2 IoT Agent JSON

- Rol: traducir payloads MQTT a entidades NGSI-LD en Orion.
- Imagen Docker: `fiware/iotagent-json:latest`.
- Puertos: `4041` (Northbound), `7896` (Southbound/agent).
- Dependencias: Mosquitto y Orion.

### 4.3 Orion Context Broker

- Rol: almacenar y servir contexto actual NGSI-LD; gestionar suscripciones.
- Imagen Docker: `fiware/orion-ld:latest`.
- Puerto: `1026`.
- Dependencias: MongoDB.

### 4.4 MongoDB

- Rol: persistencia del contexto de Orion.
- Imagen Docker: `mongo:6`.
- Puerto: `27017`.
- Dependencias: volumen persistente.

### 4.5 QuantumLeap

- Rol: persistir series temporales desde notificaciones de Orion y exponer consultas históricas.
- Imagen Docker: `orchestracities/quantumleap:latest`.
- Puerto: `8668`.
- Dependencias: Orion y CrateDB.

### 4.6 CrateDB

- Rol: base temporal/analítica para históricos de QuantumLeap.
- Imagen Docker: `crate:5`.
- Puertos: `4200` (HTTP), `5432` (PostgreSQL wire).
- Dependencias: volumen persistente.

### 4.7 Flask Backend + Flask-SocketIO

- Rol: API REST, suscripciones `/notify`, reglas de negocio, cálculo ML, emisión WebSocket y proxy de chat visitante hacia Gemini API.
- Imagen Docker: `python:3.11-slim` (build local con Dockerfile).
- Puerto: `5000`.
- Dependencias: Orion, QuantumLeap, Gemini API (cloud, vía HTTPS).

### 4.8 Frontend Web

- Rol: render de las 7 vistas, dashboard en tiempo real, vista 3D, modo Visitante y chat.
- Imagen Docker: servido por Flask o Nginx (`nginx:alpine` si se separa).
- Puerto: `80` o integrado en `5000`.
- Dependencias: Flask backend y SocketIO.

### 4.9 Grafana

- Rol: dashboards históricos y operativos embebidos en frontend.
- Imagen Docker: `grafana/grafana:latest`.
- Puerto: `3000`.
- Dependencias: CrateDB como datasource.
- Datasource provisionado: `AuraVault-CrateDB` (uid `auravault-crate`), tipo PostgreSQL sobre puerto 5432 de CrateDB.
- Dashboards provisionados desde `./grafana/dashboards/`:
  - `auravault_center_detail.json` (uid `auravault-center`) — series temporales por sala filtradas por variable `$center`.
  - `auravault_control.json` (uid `auravault-control`) — analytics avanzado para Vista 6: stat panels (Dispositivos Activos, CO2 Promedio, Pico de Aforo, Lecturas en Alerta), Status History de alertas CO2 por centro, Piechart de distribución de incidentes por categoría/severidad, Bar Gauges de batería y latencia de flota IoT, State Timeline de disponibilidad de sensores. Refresco automático 30s.
- Variables de entorno clave: `GF_SECURITY_ALLOW_EMBEDDING=true`, `GF_AUTH_ANONYMOUS_ENABLED=true`, `GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer`, `GF_SECURITY_COOKIE_SAMESITE=none`, `GF_FEATURE_TOGGLES_ENABLE=publicDashboards`.

### 4.10 Gemini API (cloud)

- Rol: responder preguntas del visitante con contexto actual de sala y obras aportado por el frontend.
- Servicio externo: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
- Autenticación: API key almacenada en `backend/gemini.key` (excluido de git), leída por Flask en cada petición.
- No requiere contenedor Docker propio; invocado desde Flask mediante `requests.post` con `timeout=30`.
- El contexto del prompt (sala, obras, métricas) no se extrae de Orion sino que llega en el body de `POST /api/chat` como `window.AURABOT_CONTEXT` del frontend.

### 4.11 Estado de implementación

- El backend Flask reutiliza consultas frecuentes mediante caché temporal y reduce carga sobre Orion.
- Las lecturas actuales se completan con histórico reciente desde QuantumLeap cuando falta estado vivo.
- Las notificaciones `/notify` se reducen a payloads mínimos para emitir solo los cambios relevantes.
- El frontend integra WebSocket para refresco inmediato de KPIs, alertas y paneles operativos, complementado con refresco periódico (fetch) de 30s en la vista de centros.
- El mapa global admite hover y navegación directa al detalle de centro.
- La vista 3D y el detalle de sala usan paneles laterales para contexto operativo sin abandonar la escena.
- Mermaid se genera con sintaxis segura compatible con la versión actual del renderizador.
- **Vista 5 (Detalle de Sala)**: Hero Card Glassmorphism actualizada por SocketIO en cada ciclo MQTT (30s). Sección de obras con lógica condicional (solo en museos) incluyendo barra de progreso visual de `stressAccumulated` y modal de ampliación de imagen. Galería de miniaturas eliminada de la sección de obras (las imágenes solo aparecen en la tabla). Gráficas históricas organizadas en grid estricto 2x2 con eje X formateado: 1h→HH:MM:SS/10min/max8, 12h→HH:MM/1h/max12, 24h→HH:MM/2h/max12; nunca índices numéricos. Tooltips de Chart.js corregidos (`animation:false`, `intersect:false`). Radar único separado de los históricos. Timeline de alertas filtradas por sala.
- **Vista 3 (Detalle de Centro)**: Tarjeta de Grafana embebido eliminada. El panel avanzado de Grafana solo se expone en Vista 6 (Centro de Control).
- **Glassmorphism global**: Sistema de diseño glassmorphism aplicado en toda la aplicación mediante `style.css`. Fondo oscuro con gradiente y blobs decorativos (body::before/after). Todas las tarjetas `.card`, `.topbar`, `.btn`, inputs, modales, items de timeline y alertas usan `backdrop-filter: blur`, rgba transparentes y bordes semitransparentes. Dark mode intensifica (blur 20px, panel 5% opacidad); light mode suaviza (blur 12px, panel 12% opacidad). Texto claro (#eef3f0) para legibilidad sobre fondo oscuro.
- **Imágenes de obras Orion**: URLs actualizadas para 17 de 24 obras (Special:FilePath→upload.wikimedia.org directo, thumbnails 960px). Las 7 restantes usan CERES con content-type image/jpeg verificado.

## 5. Tabla de servicios Docker

| Servicio | Imagen | Puerto(s) | Volúmenes | Depends_on |
|---|---|---|---|---|
| `mongo-db` | `mongo:6` | `27017:27017` | `mongo_data:/data/db` | - |
| `orion` | `fiware/orion-ld:latest` | `1026:1026` | - | `mongo-db` |
| `mosquitto` | `eclipse-mosquitto:2` | `1883:1883`, `9001:9001` | `./mosquitto/config:/mosquitto/config`, `./mosquitto/data:/mosquitto/data` | - |
| `iot-agent` | `fiware/iotagent-json:latest` | `4041:4041`, `7896:7896` | - | `orion`, `mosquitto` |
| `crate-db` | `crate:5` | `4200:4200`, `5432:5432` | `crate_data:/data` | - |
| `quantumleap` | `orchestracities/quantumleap:latest` | `8668:8668` | - | `crate-db`, `orion` |
| `backend` | `python:3.11-slim` (build local) | `5000:5000` | `./backend:/app` | `orion`, `quantumleap` |
| `grafana` | `grafana/grafana:latest` | `3000:3000` | `grafana_data:/var/lib/grafana` | `crate-db` |

## 6. Flujo completo del dato IoT

1. El simulador publica cada 30 segundos en topics MQTT por centro y sala.
2. Mosquitto recibe el mensaje y lo disponibiliza a IoT Agent JSON.
3. IoT Agent transforma la telemetría a operaciones NGSI-LD.
4. Orion actualiza entidades dinámicas (`IndoorEnvironmentObserved`, `NoiseLevelObserved`, `CrowdFlowObserved`, `Device`).
5. Orion notifica suscripciones:
   - A QuantumLeap para persistencia histórica.
   - A Flask en `/notify` para tiempo real de aplicación.
6. Flask normaliza el evento y lo emite por SocketIO.
7. El frontend actualizado (dashboard, detalle, 3D, visitante) renderiza la nueva información.

## 7. Flujo de activación de actuador

1. Usuario (Gestor/Conservador) interactúa en frontend sobre control de actuador.
2. Frontend invoca endpoint Flask de comando (`POST /api/actuators/{actuator_id}/command`).
3. Flask valida permisos, estado de sala y reglas de seguridad.
4. Flask envía comando al IoT Agent y/o actualiza estado objetivo en Orion.
5. Orion actualiza entidad `Actuator` y, opcionalmente, `Device` asociado.
6. Suscripción Orion notifica a `/notify`.
7. Flask emite evento de confirmación por SocketIO.
8. Frontend refleja estado final y dispara la animación de propagación 3D si procede.

## 8. Flujo de alertas: creación y resolución

### 8.1 Creación

- **Backend Heartbeat (30s)**: Un hilo en el backend regenera el resumen global cada 30 segundos y lo emite vía SocketIO.
- **Frontend Real-Time**: El dashboard y detalle de centro escuchan eventos de SocketIO. El explorador de centros implementa un intervalo de refresco de 30s que actualiza dinámicamente las métricas de las tarjetas mediante manipulación del DOM, reduciendo el parpadeo de gráficas.
- **Suscripciones Automáticas**: El backend asegura al arranque las suscripciones en Orion-LD para recibir notificaciones en el endpoint `/notify`.

1. Backend evalúa reglas de negocio (umbrales y combinaciones).
2. Si hay condición de riesgo, crea entidad `Alert` en Orion.
3. Orion notifica a `/notify`.
4. Flask emite alerta activa por SocketIO.
5. Frontend muestra alerta en paneles y tablas.

### 8.2 Resolución

1. Usuario ejecuta resolución en frontend.
2. Frontend envía `PATCH /api/alerts/{alert_id}/resolve`.
3. Flask actualiza `Alert.status = resolved` en Orion.
4. Orion notifica cambio a `/notify`.
5. Flask emite evento de refresco y frontend actualiza estado visual.

## 9. Flujo de cálculo de degradationRisk

1. Backend lanza tarea periódica o bajo demanda por sala/obra.
2. Consulta a QuantumLeap históricos de condiciones ambientales.
3. Construye features para scikit-learn (desviación de temperatura, humedad, CO2, ruido, iluminancia, exposición temporal).
4. Modelo produce score `degradationRisk` (0-1).
5. Backend ejecuta `PATCH` sobre entidad `Artwork` en Orion.
6. Suscripción y/o polling actualizan frontend con nuevo riesgo.

## 10. Suscripciones Orion y endpoint `/notify`

### 10.1 Suscripciones necesarias

| Entidades | Cambio observado | Destino | Finalidad |
|---|---|---|---|
| `IndoorEnvironmentObserved` | actualización de lectura | QuantumLeap | histórico temporal |
| `NoiseLevelObserved` | actualización de lectura | QuantumLeap | histórico temporal |
| `CrowdFlowObserved` | actualización de lectura | QuantumLeap | histórico temporal |
| `Device` | cambio de estado/batería | QuantumLeap | histórico de salud de flota |
| `Actuator` | cambio de estado/comando | Flask `/notify` | feedback loop en tiempo real |
| `Alert` | creación/actualización/resolución | Flask `/notify` | paneles de alertas y admin |
| `IndoorEnvironmentObserved` | cambios relevantes | Flask `/notify` | WebSocket a frontend |

### 10.2 Contrato `/notify`

- Método: `POST`.
- Entrada: payload de notificación NGSI-LD desde Orion.
- Comportamiento:
  - Validar esquema mínimo.
  - Gestionar idempotencia por `id` + `dateObserved/dateModified`.
  - Enrutar evento a canal SocketIO adecuado.
  - Registrar trazas para observabilidad.

## 11. Tabla de endpoints REST de Flask

| Método | Ruta | Descripción | Entidades NGSI-LD implicadas |
|---|---|---|---|
| GET | `/api/dashboard/summary` | KPIs agregados globales | Museum, Room, Artwork, Device, Alert |
| GET | `/api/centers` | Lista de centros con estado actual | Museum, IndoorEnvironmentObserved, CrowdFlowObserved |
| GET | `/api/centers/{center_id}` | Detalle de un centro | Museum |
| GET | `/api/centers/{center_id}/snapshot` | Snapshot ambiental de centro | IndoorEnvironmentObserved, NoiseLevelObserved, CrowdFlowObserved |
| GET | `/api/centers/{center_id}/trend` | Tendencia temporal de centro | IndoorEnvironmentObserved, CrowdFlowObserved |
| GET | `/api/centers/{center_id}/rooms` | Salas del centro | Room |
| GET | `/api/centers/{center_id}/artworks/at-risk` | Obras en riesgo | Artwork, Alert |
| GET | `/api/centers/{center_id}/history` | Histórico multivariable | IndoorEnvironmentObserved, NoiseLevelObserved, CrowdFlowObserved |
| GET | `/api/centers/{center_id}/actuators` | Actuadores de centro | Actuator |
| POST | `/api/actuators/{actuator_id}/command` | Comando de actuador | Actuator, Device |
| GET | `/api/rooms/{room_id}` | Detalle de sala | Room |
| GET | `/api/rooms/{room_id}/environment/current` | Lecturas actuales de sala | IndoorEnvironmentObserved, NoiseLevelObserved, CrowdFlowObserved |
| GET | `/api/rooms/{room_id}/history` | Histórico de sala | IndoorEnvironmentObserved, NoiseLevelObserved, CrowdFlowObserved |
| GET | `/api/rooms/{room_id}/artworks` | Obras en sala | Artwork |
| GET | `/api/artworks/{artwork_id}` | Ficha de obra | Artwork |
| GET | `/api/artworks/{artwork_id}/history` | Histórico de obra | Artwork, IndoorEnvironmentObserved, Alert |
| GET | `/api/artworks/{artwork_id}/alerts` | Alertas de obra | Alert |
| GET | `/api/artworks/compare` | Comparador de obras | Artwork, Alert |
| GET | `/api/rooms/{room_id}/passport` | Pasaporte ambiental | Room, IndoorEnvironmentObserved, NoiseLevelObserved, CrowdFlowObserved, Alert |
| GET | `/api/admin/alerts` | Alertas filtradas | Alert |
| GET | `/api/admin/alerts/stats` | Estadísticas de alertas | Alert |
| PATCH | `/api/alerts/{alert_id}/resolve` | Resolver alerta | Alert |
| GET | `/api/admin/devices` | Estado de flota | Device |
| GET | `/api/devices/{device_id}` | Detalle de dispositivo | Device |
| GET | `/api/devices/{device_id}/prediction` | Predicción de fallo | Device, Alert |
| GET | `/api/grafana/center/{center_id}` | URL/embedding dashboard por centro | Museum |
| GET | `/api/grafana/admin` | URL/embedding dashboards admin | Device, Alert |
| GET | `/visitor/{poi_id}` | Vista web pública Visitante | Museum |
| GET | `/api/public/poi/{poi_id}` | Datos básicos de POI | Museum |
| GET | `/api/public/poi/{poi_id}/summary` | Resumen ambiental visitante | IndoorEnvironmentObserved, CrowdFlowObserved |
| GET | `/api/public/poi/{poi_id}/rooms` | Salas públicas del centro | Room |
| GET | `/api/public/poi/{poi_id}/recommended-room` | Recomendación de sala | Room, IndoorEnvironmentObserved, CrowdFlowObserved |
| POST | `/notify` | Receptor de suscripciones Orion | IndoorEnvironmentObserved, NoiseLevelObserved, CrowdFlowObserved, Device, Actuator, Alert |
| POST | `/api/chat` | Proxy de chatbot AuraBot hacia Gemini API; recibe historial y `AURABOT_CONTEXT` del frontend | ninguna (contexto llega del cliente) |

## 12. Chatbot Visitante (AuraBot — Gemini API)

### 12.1 Objetivo

AuraBot es un widget de chat flotante que aparece exclusivamente en modo Visitante (`?mode=visitor`) en las páginas de detalle de centro (`center_detail.html`) y detalle de sala (`room_artwork.html`). Responde preguntas en lenguaje natural sobre condiciones ambientales, obras expuestas e historia del espacio.

### 12.2 Componentes

| Componente | Ubicación | Rol |
|---|---|---|
| `chatbot.js` | `static/js/chatbot.js` | Widget FAB + panel de chat; gestiona historial en `sessionStorage` |
| `window.AURABOT_CONTEXT` | Seteado por `center_detail.js` y `room_artwork.js` | Objeto con todos los datos ya mostrados en pantalla |
| `POST /api/chat` | `app.py` | Proxy Flask hacia Gemini API; construye system prompt |
| `gemini.key` | `backend/gemini.key` (excluido de git) | Clave API para `gemini-2.5-flash` |

### 12.3 Flujo completo

1. El visitante activa modo visitante (`?mode=visitor`) en la página de detalle de centro o sala.
2. `chatbot.js` detecta `isVisitorMode()` y monta el botón FAB circular (fixed, z-index 99999).
3. Al escribir una pregunta, el frontend lee `window.AURABOT_CONTEXT` (ya en memoria) y envía a Flask:
   ```json
   { "messages": [...historial sessionStorage], "context": { ...AURABOT_CONTEXT }, "lang": "es" }
   ```
4. Flask lee la clave desde `backend/gemini.key`, construye el system prompt inyectando el contexto **y el idioma activo** (`lang`) y llama a Gemini API:
   ```
   POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=...
   ```
5. Gemini devuelve respuesta natural en el idioma solicitado; Flask la retransmite al frontend como `{"reply": "..."}`.
6. El historial de la conversación se persiste en `sessionStorage` (máx. 40 mensajes, clave `aurabot_history`).

### 12.4 Estructura de `window.AURABOT_CONTEXT`

**Para sala (`room_artwork.js`):**
```json
{
  "tipo": "sala", "sala": "...", "centro": "...",
  "temperatura": 21.4, "humedad": 54.2, "co2": 825,
  "aforo": 0.45, "personas": 18, "ruido": 42.1,
  "obras": [{"nombre": "...", "artista": "...", "año": 1888, "tecnica": "...", "material": "...", "riesgo": 0.32, "estado": "watch"}]
}
```

**Para centro (`center_detail.js`):**
```json
{
  "tipo": "centro", "centro": "...", "descripcion": "...",
  "temperatura": 20.1, "co2": 710, "personas": 94,
  "estado": "attention", "alertasActivas": 2,
  "salas": [{"nombre": "...", "descripcion": "..."}]
}
```

### 12.5 System prompt de Flask (multiidioma)

El prompt base varía según el campo `lang` recibido en el body del request:

**ES (`lang == "es"`):**
```text
Eres AuraBot, el asistente inteligente de AuraVault para visitantes de centros culturales.
Tu misión es ayudar a los visitantes a descubrir las obras, entender el ambiente de la sala
y conocer la historia del centro. Responde siempre en español, de forma amigable, cercana y concisa.
```

**EN (`lang == "en"`):**
```text
You are AuraBot, AuraVault's intelligent assistant for visitors to cultural centers.
Your mission is to help visitors discover artworks, understand the room environment
and learn about the center's history. Always respond in English, in a friendly, warm and concise way.
```

Si el contexto está vacío, el mensaje de respaldo también se adapta al idioma activo.

### 12.6 Widget — comportamiento

- Botón FAB circular fijo (bottom-right, `position:fixed`, `z-index:99999`) siempre visible durante el scroll.
- Panel 350×500 px con animación de apertura (`chatPanelIn`).
- Botón de cierre (X) y botón de limpiar conversación (papelera).
- Indicador "pensando" traducido según idioma activo (`tr('aurabotThinking')`).
- Mensaje de error de conexión traducido (`tr('connectionError')`).
- El campo `lang: AURA.lang` se envía en cada petición a `/api/chat` para que las respuestas de Gemini respeten el idioma activo.
- Tecla `Enter` envía; `Shift+Enter` no envía.
- No aparece en ninguna otra página (dashboard, control center, centros, etc.).

## 13b. Arquitectura i18n (CORRECCIÓN 3 — 2026-05-13)

### Modelo de traducciones

Todas las traducciones residen en `AURA.t.es` y `AURA.t.en` dentro de `common.js`. La función `tr(key)` devuelve la cadena en el idioma activo (`AURA.lang`). Los elementos HTML estáticos usan `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` y `data-i18n-alt`; `applyTranslations()` los actualiza en cada cambio de idioma.

### Evento `aura:langchange`

`setLang(lang)` en `common.js` despacha un `CustomEvent('aura:langchange')` al documento tras actualizar `AURA.lang` y ejecutar `applyTranslations()`. Cada módulo JS de página escucha este evento y re-renderiza sus componentes dinámicos (Chart.js, radar, actuadores, paneles de dispositivos, vista visitante).

```
Usuario pulsa toggle →
  setLang() →
    AURA.lang = 'en' | 'es'
    applyTranslations()          ← actualiza data-i18n en el DOM
    dispatchEvent('aura:langchange')
      → dashboard.js: loadTrend()
      → center_detail.js: loadHistory() + loadActuators()
      → room_artwork.js: renderRadar() + renderIndividualCharts() + renderArtworkTable()
      → control_center.js: loadAlertsTab() + loadDevicesTab()
```

### Locales de fechas

Todos los callbacks `toLocaleTimeString` / `toLocaleString` usan `AURA.lang === 'en' ? 'en-GB' : 'es-ES'` en lugar de literales hardcodeados, garantizando formato de hora correcto en ambos idiomas.

### AuraBot multiidioma

`POST /api/chat` acepta el campo `lang` en el body. `_build_chatbot_system_prompt(ctx, lang)` construye un system prompt en el idioma indicado, instruyendo a Gemini a responder en español o inglés según la preferencia activa del visitante.

## 13. Decisiones de diseño relevantes

### 13.1 NGSI-LD frente a NGSIv2

Se elige NGSI-LD porque permite semántica explícita, relaciones ricas entre entidades y mayor interoperabilidad futura con ecosistemas FIWARE y smart data models modernos.

### 13.2 Flask-SocketIO para tiempo real

Se elige Flask-SocketIO para emitir cambios en tiempo real desde un backend Python unificado que ya implementa APIs REST, reglas de negocio y integración con Orion/QuantumLeap, evitando duplicidad de servicios.

### 13.3 CrateDB como backend de QuantumLeap

Se elige CrateDB por su rendimiento en series temporales y consultas analíticas agregadas, útil para dashboards, comparativas de centros y cálculo de features para modelos ML.

### 13.4 Gemini API para Visitante (CORRECCIÓN 2)

Se adopta Gemini API (`gemini-2.5-flash`) en sustitución del LLM local (Gemma/Ollama). La API key se almacena únicamente en el servidor (`backend/gemini.key`, excluido de git). El frontend envía el contexto ya renderizado (`window.AURABOT_CONTEXT`) en lugar de forzar al backend a consultar Orion, lo que elimina latencia adicional y garantiza coherencia con lo que el visitante ve en pantalla.

## 14. Dependencias entre servicios

- `orion` depende de `mongo-db`.
- `iot-agent` depende de `orion` y `mosquitto`.
- `quantumleap` depende de `orion` y `crate-db`.
- `backend` depende de `orion` y `quantumleap`. El chatbot llama a Gemini API (cloud) sin contenedor local adicional.
- `grafana` depende de `crate-db`.

## 15. Checklist de implementación (MVP — consolidación final)

- Suscripciones Orion a QuantumLeap y a `/notify` creadas al arranque.
- Simulador MQTT publicando cada 30 segundos con variación física realista para 24 salas.
- Simulador con lógica de alertas periodicas forzadas: cada 10 ciclos (~5min) la sala designada de cada centro genera "Humedad fuera de rango" o "CO2 elevado" durante 3 ciclos consecutivos.
- Backend exponiendo endpoints REST y WebSocket. Hilo de fondo emite `"summary"` + `"update"` cada 30s a todas las vistas.
- Frontend: Dashboard, Detalle de Centro/Sala y Centro de Control suscritos a eventos SocketIO para refresco sin recarga.
- Flujo de riesgo de degradación operativo con PATCH a Orion.
- Modo Visitante con chatbot AuraBot operativo mediante Gemini API (`gemini-2.5-flash`).
- Imagenes locales: 24 salas y 9 obras clave servidas desde `/static/images/` (rutas relativas en `catalog.py`).
- Grafana `auravault_control` con 7 paneles usando `time_index` y `etindoorenvironmentobserved`, incluyendo "Promedio de Humedad por Centro" y "Evolución Crítica de CO2 >800 ppm".
- i18n ES/EN completo en `AURA.t` de `common.js`: metricas, estados, alertas, chatbot, tooltips y placeholders.

## 17. Consolidacion final (2026-05-13)

### Gestión de activos locales (imagenes)

Todas las entidades `Room` del catalogo (`scripts/catalog.py`) usan rutas locales `/static/images/rooms/<sala>.jpeg`. Las obras con imagen historica propia (Sargadelos, Goya, Modesto Brocos, Asorey, Lente Fresnel, Cornellis de Vos) usan `/static/images/artworks/<obra>.jpeg`. Las imagenes se copian a `backend/static/images/` para ser servidas directamente por Flask.

### Simulador MQTT — alertas periodicas

Se añade lógica determinista en `update_state()`:
- Constante `_ALERT_ROOM_BY_CENTER`: sala designada por centro para inyectar alertas.
- `_ALERT_CYCLE_PERIOD = 10`, `_ALERT_CYCLE_DURATION = 3`: cada 10 ciclos, fuerza alerta durante 3.
- Ciclos pares: `humidity_target = 72` (fuera de rango).
- Ciclos impares: `co2_target = 950` (>800 ppm).

### Grafana — paneles nuevos

Se eliminaron "Pico de Aforo Urbano" y "Distribucion de Incidentes por Categoria y Severidad". Se añadieron:
- **Promedio de Humedad por Centro** (`barchart`): CASE/LIKE para mapear `entity_id` a nombre de centro, AVG por GROUP BY.
- **Evolución Crítica de CO2 >800 ppm** (`timeseries`): filtra `co2 > 800`, desglosa por centro.

### SocketIO universal

El `background_update_thread` ahora emite `"update"` (heartbeat) además de `"summary"` cada 30s. La vista Control suscribe a `"update"` para refrescar estadísticas de alertas. Todas las vistas reciben refresco automático sin intervención del usuario.

### i18n completo

Añadidas al objeto `AURA.t` (ES y EN): `history`, `historicalTrend`, `historicalAnalytics`, `alertsTimeline`, `conditionStatus`, `degradationRisk`, `stressAccumulated`, `resolved`, `unresolved`, `from`, `artworks`, `stateOn/Off/Fault/Maintenance`, categorias y severidades de alertas, textos del chatbot AuraBot.

## 16. Cambios de arquitectura CSS/UI — Sesión 2 (2026-05-06)

### Sistema de variables glass

Se introduce un sistema centralizado de variables CSS en `:root` y `[data-theme="dark"]` que desacopla los valores glass de los componentes:

```
```

En modo claro: transparencias blancas altas (0.46–0.86), bordes oscuros suaves (`rgba(0,0,0,0.13)`), fondo base `#c4ddd8`.
En modo oscuro: transparencias blancas bajas (0.05–0.14), bordes claros tenues (`rgba(255,255,255,0.09)`), fondo base `#060e0d`.

### Eliminación total de Grafana

El iframe de Grafana y la función `loadGrafana()` han sido eliminados completamente. El panel `center_detail.html` ya no incluye ningún bloque Grafana. El JS de `center_detail.js` no hace ninguna llamada a Grafana.

### Imágenes de sala

El campo `imageUrl` de las 24 entidades `Room` en Orion Context Broker ha sido actualizado con URLs directas a `upload.wikimedia.org` (thumbnail 800px). Las imágenes son congruentes con el tipo de espacio de cada sala (museo de ciencia, galería de arte, teatro, sala de conciertos).

## Implementación — Issue #17

- Branch: `feature/issue-17-ui-artwork-cleanup`
- Commit: `55970aa` — Hugo — 2026-05-06 18:57:33 +0200

Cambios relevantes:

- Sistema de variables CSS (`:root`) y glassmorphism centralizado en `static/css/style.css`.
- Eliminación del iframe de Grafana en `center_detail.html` y limpieza de la función `loadGrafana()`.
- URLs de imágenes de sala y obras actualizadas en Orion; verificar caché tras deploy.


## Issue #20 — Mejoras de UI en Alertas

### Patrón de resolución optimista

Al resolver una alerta desde Dashboard o Control, el flujo es:

1. `PATCH /api/alerts/{id}/resolve` → Flask actualiza Orion + emite `socketio.emit("alerts", {action: "resolved", alertId: id})`
2. El cliente que hizo el PATCH elimina el item/fila con animación CSS (optimistic removal)
3. Todos los demás clientes reciben el evento WebSocket y eliminan también su fila (sin recarga)

Esto garantiza consistencia sin forzar recarga de todos los clientes al resolver una alerta.

### Endpoint `/api/admin/alerts/stats`

Acepta ahora los mismos filtros query (`center`, `type`, `severity`, `status`) que `/api/admin/alerts`. El frontend pasa los mismos params a ambos endpoints en cada llamada, garantizando que la gráfica de distribución siempre refleja la misma vista filtrada que la tabla.

### Selectores dinámicos de filtros

Los selectores de Tipo, Severidad y Estado se construyen completamente en JS a partir de los valores únicos presentes en el dataset retornado por `/api/admin/alerts`. El valor seleccionado se persiste en `_alertFilterState` y se restaura tras cada re-render del `<select>`, evitando el estado intermedio de "Todos".

## CORRECCIÓN 2 — Chatbot AuraBot con Gemini API

### Alcance

Implementación del widget chatbot AuraBot visible únicamente en modo Visitante (`?mode=visitor`) en las vistas de detalle de centro y sala. Sustituye el LLM local (Gemma/Ollama) por Gemini API cloud.

### Archivos nuevos

| Archivo | Descripción |
|---|---|
| `backend/static/js/chatbot.js` | Widget FAB + panel de chat, historial sessionStorage, fetch a `/api/chat` |
| `backend/gemini.key` | API key de Gemini (excluido de git mediante `.gitignore`) |
| `.gitignore` | Excluye `backend/gemini.key` |

### Archivos modificados

| Archivo | Cambios |
|---|---|
| `backend/app.py` | Nuevo endpoint `POST /api/chat` con proxy hacia Gemini API |
| `backend/static/css/style.css` | Estilos del widget: FAB, panel, burbujas, animación de apertura |
| `backend/static/js/center_detail.js` | Setea `window.AURABOT_CONTEXT` tras cargar datos del centro |
| `backend/static/js/room_artwork.js` | Setea `window.AURABOT_CONTEXT` tras cargar sala y obras |
| `backend/templates/center_detail.html` | Añade `<script src="chatbot.js">` antes de `</body>` |
| `backend/templates/room_artwork.html` | Añade `<script src="chatbot.js">` antes de `</body>` |

### Decisiones de implementación

- **Contexto desde frontend**: `window.AURABOT_CONTEXT` evita una consulta extra a Orion por cada mensaje; el contexto refleja exactamente lo que el visitante ve en pantalla.
- **API key solo en servidor**: el frontend nunca recibe ni puede inferir la clave; Flask la lee de `gemini.key` en disco.
- **Modelo seleccionado**: `gemini-2.5-flash` (verificado disponible con la clave del proyecto; `gemini-1.5-flash` devuelve 404).
- **Historial con sessionStorage**: máx. 40 mensajes, se pierde al cerrar la pestaña (no hay datos personales persistidos).
- **`use_reloader=False` en Docker**: los cambios en `app.py` requieren `docker restart auravault-backend`.
