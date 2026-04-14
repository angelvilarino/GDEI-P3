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
- Extensión de IA conversacional con LLM local vía API para el rol Visitante.

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

  subgraph LLM[Asistente Local]
    GEMMA[LLM API local\nGemma/Ollama-compatible]
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

  CHAT -->|question + poi_id| FLASK
  FLASK -->|context build: Room/Artwork/IndoorEnvironmentObserved| ORION
  FLASK -->|LLM API call| GEMMA
  GEMMA -->|natural language answer| FLASK
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

- Rol: API REST, suscripciones `/notify`, reglas de negocio, cálculo ML, emisión WebSocket y proxy de chat visitante.
- Imagen Docker: `python:3.11-slim` (build local con Dockerfile).
- Puerto: `5000`.
- Dependencias: Orion, QuantumLeap, LLM local.

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

### 4.10 LLM local (Gemma)

- Rol: responder preguntas del visitante con contexto actual de sala y obras.
- Imagen Docker: `ollama/ollama:latest` o runtime equivalente local con modelo Gemma.
- Puerto: `11434` (API local típica).
- Dependencias: volumen de modelos; invocado por Flask.

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
| `llm-local` | `ollama/ollama:latest` | `11434:11434` | `ollama_data:/root/.ollama` | - |

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
| POST | `/api/public/chat/context` | Construcción de contexto para chat visitante | Room, Artwork, IndoorEnvironmentObserved |
| POST | `/api/public/chat/ask` | Pregunta del visitante al asistente | Room, Artwork, IndoorEnvironmentObserved |

## 12. Chatbot Visitante (LLM local)

### 12.1 Objetivo

El modo Visitante en `/visitor/<poi_id>` incorpora un widget de chat para responder preguntas sobre condiciones ambientales de la sala y obras expuestas, con lenguaje claro y no técnico.

### 12.2 Flujo completo

1. El visitante escribe una pregunta en el widget de chat.
2. El frontend llama a `POST /api/public/chat/ask` con `poi_id`, `room_id` opcional, idioma y pregunta.
3. Flask consulta Orion para construir contexto actual:
   - `IndoorEnvironmentObserved` de la sala/centro.
   - `Room` activa y metadatos de capacidad/tipo.
   - `Artwork` expuestas en la sala.
4. Flask construye prompt de sistema + contexto estructurado + pregunta del usuario.
5. Flask invoca API local del LLM (Gemma preferente).
6. LLM devuelve respuesta natural.
7. Flask aplica filtros de seguridad y devuelve respuesta al frontend.

### 12.3 Prompt de sistema del backend

```text
Eres AuraVault Assistant para visitantes de museos y teatros.
Responde de forma breve, clara y amable en el idioma del visitante (es o en).
Usa solo la información de contexto proporcionada por el backend.
No inventes obras, valores ambientales ni recomendaciones no justificadas.
Si faltan datos, dilo explícitamente y ofrece la mejor orientación posible con lo disponible.
Prioriza seguridad y confort del visitante.
No des consejos médicos ni afirmaciones técnicas no verificables.
```

### 12.4 Endpoints del chat

- `POST /api/public/chat/context`
  - Entrada: `poi_id`, `room_id` opcional.
  - Salida: contexto estructurado para depuración/telemetría.
- `POST /api/public/chat/ask`
  - Entrada: `poi_id`, `room_id` opcional, `question`, `language`.
  - Salida: `answer`, `sources_used`, `timestamp`.

### 12.5 Requisitos operativos de seguridad

- Rate limiting por IP/sesión en endpoints de chat.
- Timeout de llamada LLM con fallback de respuesta.
- Sanitización de entrada y protección básica frente a prompt injection.
- No almacenamiento de datos personales del visitante.

## 13. Decisiones de diseño relevantes

### 13.1 NGSI-LD frente a NGSIv2

Se elige NGSI-LD porque permite semántica explícita, relaciones ricas entre entidades y mayor interoperabilidad futura con ecosistemas FIWARE y smart data models modernos.

### 13.2 Flask-SocketIO para tiempo real

Se elige Flask-SocketIO para emitir cambios en tiempo real desde un backend Python unificado que ya implementa APIs REST, reglas de negocio y integración con Orion/QuantumLeap, evitando duplicidad de servicios.

### 13.3 CrateDB como backend de QuantumLeap

Se elige CrateDB por su rendimiento en series temporales y consultas analíticas agregadas, útil para dashboards, comparativas de centros y cálculo de features para modelos ML.

### 13.4 LLM local para Visitante

Se prioriza LLM local (Gemma) por privacidad, control operativo y reducción de dependencia de servicios externos. El backend conserva control completo del contexto enviado al modelo.

## 14. Dependencias entre servicios

- `orion` depende de `mongo-db`.
- `iot-agent` depende de `orion` y `mosquitto`.
- `quantumleap` depende de `orion` y `crate-db`.
- `backend` depende de `orion`, `quantumleap` y `llm-local` (si chat activo).
- `grafana` depende de `crate-db`.

## 15. Checklist de implementación (MVP)

- Suscripciones Orion a QuantumLeap y a `/notify` creadas al arranque.
- Simulador MQTT enviando payloads cada 30 segundos con variación realista.
- Backend exponiendo endpoints REST y WebSocket.
- Frontend consumiendo WebSocket para KPI, alertas y estado de actuadores.
- Flujo de riesgo de degradación operativo con PATCH a Orion.
- Modo Visitante con chat contextual operativo sobre LLM local.

