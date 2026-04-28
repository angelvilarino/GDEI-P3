# PLAN DE IMPLEMENTACIÓN — AuraVault

**Estado**: PLAN (Esperando aprobación antes de modificar)
**Fecha**: 28 de abril de 2026

---

## PASO 0 — Diagnóstico de datos (OBLIGATORIO ANTES DE FRONTEND)

### 0.1 Verificar pipeline IoT extremo a extremo

**Causa raíz**: No confirmado que los datos fluyan correctamente desde MQTT → IoT Agent → Orion → QuantumLeap.

**Acciones requeridas**:
1. Ejecutar script de importación: `scripts/import_data.py`
   - Importa estáticos: Museum, Room, Artwork, Device, DeviceModel, Alert, Actuator
   - **Ubicación**: [scripts/import_data.py](scripts/import_data.py#L1)
   - **Verificación**: Consultar Orion y mostrar conteo de entidades por tipo

2. Iniciar simulador MQTT: `simulator/mqtt_simulator.py`
   - Publica cada 30 segundos en topics: `auravault/<centro>/<sala>/*`
   - **Ubicación**: [simulator/mqtt_simulator.py](simulator/mqtt_simulator.py#L1)
   - **Verificación**: Suscribirse a `auravault/#` en Mosquitto y capturar al menos 3 mensajes

3. Verificar IoT Agent transforma MQTT a NGSI-LD
   - **Ubicación**: Orion debe actualizar `IndoorEnvironmentObserved`, `NoiseLevelObserved`, `CrowdFlowObserved`
   - **Verificación**: `curl http://localhost:1026/ngsi-ld/v1/entities?type=IndoorEnvironmentObserved`

4. Verificar QuantumLeap recibe notificaciones
   - **Ubicación**: Orion debe tener suscripción a QuantumLeap
   - **Verificación**: `curl http://localhost:8668/v2/entities | grep -c IndoorEnvironmentObserved`

5. Verificar backend Flask `/api/dashboard/summary` retorna datos reales
   - **Ubicación**: NO EXISTE AÚN (crear en app.py)
   - **Verificación**: Debe devolver JSON con `kpis` (visitorsTotal, roomsOptimalPct, artworksAtRisk, sensorsActive, sensorsTotal)

**BLOQUEADOR**: Si PASO 0 falla, no continuar con resto. El frontend no puede mostrar datos que el backend no tiene.

---

## PASO 1 — KPIs a 0 en vista inicial

### Causa raíz

El endpoint `/api/dashboard/summary` no existe en el backend Flask, y los endpoints `/api/centers` tampoco. El frontend intenta renderizar valores nulos.

### Ubicaciones exactas

**Backend** [backend/app.py](backend/app.py#L1):
- **Línea ~900+** (NO EXISTE): Falta implementar `@app.route('/api/dashboard/summary')` 
- **Línea ~900+** (NO EXISTE): Falta implementar `@app.route('/api/centers')`
- **Línea ~900+** (NO EXISTE): Falta implementar `@app.route('/api/centers/<center_id>/snapshot')`
- **Línea ~900+** (NO EXISTE): Falta implementar `@app.route('/api/centers/<center_id>/trend')`

**Frontend** [backend/static/js/dashboard.js](backend/static/js/dashboard.js#L25-L40):
- **Línea 25-40**: Función `loadSummary()` llama a `apiGet('/api/dashboard/summary')` que falla
- **Línea 30-34**: Asignación de KPIs usa `formatMetric()` con `zeroAsMissing: false`, lo que muestra correctamente 0 válidos pero no null

### Solución concreta

1. **Implementar GET `/api/dashboard/summary` en app.py**
   - Función helper `center_snapshot(center_id)` ya existe (línea ~400)
   - Agregar endpoint que:
     ```python
     @app.route('/api/dashboard/summary', methods=['GET'])
     def dashboard_summary():
         centers = [resolve_center(m["id"]) for m in MUSEUMS]
         snapshots = [center_snapshot(c["id"]) for c in centers]
         
         # Calcular agregados globales
         kpis = {
             "visitorsTotal": sum(s.get("peopleCount", 0) for s in snapshots),
             "roomsOptimalPct": ...,  # Porcentaje salas "optimal"
             "artworksAtRisk": ...,    # Contar Artwork con degradationRisk > 0.35
             "sensorsActive": ...,     # Contar Device con deviceState="on"
             "sensorsTotal": len(device_entities())
         }
         return jsonify({"kpis": kpis, "timestamp": utc_now()})
     ```
   - **Agregar logging**: `LOGGER.debug("KPI visitorsTotal=%d", kpis["visitorsTotal"])`

2. **Implementar GET `/api/centers` en app.py**
   - Devolver lista de centers con snapshot y status actual
   - Usar función existente `center_snapshot()` para cada centro
   - Mapear correctamente campos JSON:
     ```python
     centers_list = []
     for museum in MUSEUMS:
         snap = center_snapshot(museum["id"])
         centers_list.append({
             "id": museum["id"],
             "code": museum["code"],
             "name": museum["name"],
             "type": museum.get("museumType", "museum"),
             "status": snap.get("status", "attention"),
             "image": museum.get("image", ""),
             "location": {"type": "Point", "coordinates": museum["location"]["coordinates"]},
             "snapshot": snap,
             "timestamp": utc_now()
         })
     return jsonify(centers_list)
     ```

3. **Verificación**: `curl http://localhost:5000/api/dashboard/summary | python -m json.tool` debe mostrar valores > 0

---

## PASO 2 — Diagrama Mermaid

### Causa raíz

El elemento `#modelMermaid` en dashboard.html está vacío. Falta endpoint `/api/model/graph` que genere el diagrama NGSI-LD.

### Ubicaciones exactas

**Frontend** [backend/templates/dashboard.html](backend/templates/dashboard.html#L40-L50):
- **Línea 42**: `<pre class="mermaid" id="modelMermaid"></pre>` está vacío

**Frontend JS** [backend/static/js/dashboard.js](backend/static/js/dashboard.js#L150+):
- **NO EXISTE**: Falta función `loadModelGraph()` que llame a `/api/model/graph`

**Backend** [backend/app.py](backend/app.py#L900+):
- **NO EXISTE**: Falta endpoint `@app.route('/api/model/graph')`

### Solución concreta

1. **Implementar GET `/api/model/graph` en app.py**
   - Generar diagrama Mermaid compatible con versión 10.9.5
   - Usar sintaxis segura: sin caracteres especiales en etiquetas, sin paréntesis/corchetes en nodos
   - Plantilla validada:
     ```python
     @app.route('/api/model/graph', methods=['GET'])
     def model_graph():
         mermaid = """graph TD
     Museum["Museum<br/>Centro cultural"]
     Room["Room<br/>Sala"]
     Artwork["Artwork<br/>Obra"]
     Device["Device<br/>Sensor"]
     DeviceModel["DeviceModel<br/>Modelo dispositivo"]
     IndoorEnv["IndoorEnvironmentObserved<br/>Ambiente interior"]
     Noise["NoiseLevelObserved<br/>Ruido"]
     Crowd["CrowdFlowObserved<br/>Aforo"]
     Alert["Alert<br/>Alerta"]
     Actuator["Actuator<br/>Actuador"]
     
     Museum -->|contains| Room
     Room -->|exposes| Artwork
     Device -->|refDeviceModel| DeviceModel
     IndoorEnv -->|refDevice| Device
     IndoorEnv -->|refPointOfInterest| Room
     Noise -->|refDevice| Device
     Noise -->|refPointOfInterest| Room
     Crowd -->|refDevice| Device
     Crowd -->|refPointOfInterest| Room
     Alert -->|alertSource| Device
     Actuator -->|isLocatedIn| Room
     Actuator -->|isControlledBy| Device"""
         return jsonify({"graph": mermaid})
     ```

2. **Agregar `loadModelGraph()` en dashboard.js**
   - Llamar a `/api/model/graph` al cargar página
   - Llenar `#modelMermaid` con contenido
   - Reinicializar Mermaid: `mermaid.contentLoaded()`

3. **Validación**: Pegar salida JSON en https://mermaid.live para confirmar sintaxis válida

---

## PASO 3 — Aforo al 0% en vista de centros

### Causa raíz

El campo `snapshot.avgOccupancy` en `/api/centers` es null o no se calcula correctamente. Fórmula esperada: `currentOccupancy / capacity * 100`.

### Ubicaciones exactas

**Backend** [backend/app.py](backend/app.py#L340):
- **Línea ~345-365**: Función `center_snapshot()` calcula `avgOccupancy` de `crowd.get("occupancy", 0.0)`
- **PROBLEMA**: `CrowdFlowObserved.occupancy` en Orion es un ratio (0.0-1.0), no un porcentaje
- **RESULTADO**: Muestra 0.34 en lugar de 34%

**Frontend** [backend/static/js/centers.js](backend/static/js/centers.js#L50):
- **Línea ~50-60**: Renderiza snapshot.avgOccupancy directamente sin multiplicar por 100

### Solución concreta

1. **Corregir `center_snapshot()` en app.py**
   - Cambiar línea ~355 de:
     ```python
     values["occupancy"].append(float(crowd.get("occupancy", 0.0)))
     ```
   - A:
     ```python
     occupancy_ratio = float(crowd.get("occupancy", 0.0))
     values["occupancy"].append(occupancy_ratio * 100)  # Convertir ratio a porcentaje
     ```
   - Asegurar promedio final es porcentaje: `avgOccupancy: round(sum(...) / len(...) * 100, 1) if ... else None`

2. **Frontend** [backend/static/js/centers.js](backend/static/js/centers.js#L60):
   - **NO modificar**: El formato de visualización ya es correcto
   - `formatMetric(c.snapshot.avgOccupancy, { digits: 0, unit: '%', zeroAsMissing: false })`
   - Esto mostrará "34 %" correctamente si backend devuelve 34

3. **Verificación**: 
   - `curl http://localhost:5000/api/centers | jq '.[0].snapshot.avgOccupancy'` 
   - Debe mostrar número entre 0 y 100

---

## PASO 4 — Gráfica de temperatura y ocupación confusa

### Causa raíz

El histórico multivariable en center_detail.html muestra todas las variables superpuestas en una sola gráfica Chart.js, con dos ejes Y diferentes pero ambos en la misma escala visual.

### Ubicaciones exactas

**Frontend** [backend/templates/center_detail.html](backend/templates/center_detail.html#L30-L40):
- **Línea 30-40**: Un único `<canvas id="historyChart">` que debería mostrar dos gráficas

**Frontend JS** (NO LEÍDO AÚN, pero inferido desde HTML):
- **backend/static/js/center_detail.js**: Función que renderiza `historyChart` con Chart.js

### Solución concreta

1. **Modificar HTML para dos gráficas separadas** [backend/templates/center_detail.html](backend/templates/center_detail.html#L34):
   - Reemplazar sección única por dos contenedores:
     ```html
     <div class="controls-row">
       <h3 style="margin:0" data-i18n="historyTitle">Histórico multivariable</h3>
       <select id="rangeSelect" class="input">
         <option value="1h">1h</option>
         <option value="6h">6h</option>
         <option value="24h" selected>24h</option>
         <option value="7d">7d</option>
       </select>
     </div>
     <div class="chart-wrap" style="height:250px;margin-top:8px">
       <h4 style="margin:0">Temperatura y Humedad</h4>
       <canvas id="historyChartTemp"></canvas>
     </div>
     <div class="chart-wrap" style="height:250px;margin-top:8px">
       <h4 style="margin:0">Ocupación</h4>
       <canvas id="historyChartOccupancy"></canvas>
     </div>
     ```

2. **Implementar dos gráficas en center_detail.js** (SE REQUERIRÁ LECTURA/MODIFICACIÓN):
   - Primera gráfica: Línea de temperatura (eje Y °C, naranja)
   - Segunda gráfica: Barras de ocupación (eje Y personas, azul)
   - Ambas con eje X en HH:MM y rango visible en título

---

## PASO 5 — Bug de cards que se estiran infinitamente

### Causa raíz

El panel de detalle de sala se inserta en el DOM dentro de la card principal, causando que la card crezca indefinidamente cuando el panel se expande.

### Ubicaciones exactas

**Frontend** (a confirmar en center_detail.js):
- Problema: Detalle de sala renderizado como innerHTML dentro de card
- Necesita: Modal o panel lateral con `position: fixed`

### Solución concreta

1. **Crear estructura modal en HTML**
   - Agregar al final de center_detail.html:
     ```html
     <div id="roomDetailPanel" class="room-panel-modal" style="display:none;position:fixed;right:0;top:0;width:400px;height:100vh;overflow-y:auto;background:white;z-index:1000;box-shadow:-2px 0 8px rgba(0,0,0,0.15);padding:16px">
       <div style="display:flex;justify-content:space-between;align-items:center">
         <h3 id="roomPanelTitle" style="margin:0"></h3>
         <button id="closeRoomPanel" class="btn" style="width:32px;height:32px;padding:0">✕</button>
       </div>
       <div id="roomPanelContent"></div>
     </div>
     ```

2. **Estilos CSS** [backend/static/css/style.css](backend/static/css/style.css):
   - Agregar al final:
     ```css
     .room-panel-modal {
       backdrop-filter: blur(0px);
       animation: slideIn 0.25s ease-out;
     }
     @keyframes slideIn {
       from { transform: translateX(100%); }
       to { transform: translateX(0); }
     }
     ```

3. **Manejador de eventos** (en center_detail.js):
   - Al clicar una sala, abrir panel con datos de `/api/rooms/{room_id}/environment/current`
   - Botón cierre: `document.getElementById("closeRoomPanel").style.display = "none"`

---

## PASO 6 — Histórico multivariable confuso en detalle de centro

### Causa raíz

La gráfica histórica muestra todas las variables (temp, humedad, CO2, ruido, aforo) superpuestas sin permitir selección.

### Ubicaciones exactas

**Frontend** [backend/templates/center_detail.html](backend/templates/center_detail.html#L34-L36):
- **Línea 35**: `<select id="rangeSelect">` selector de rango temporal
- **FALTA**: Selector de variable (radio buttons o tabs)

### Solución concreta

1. **Agregar selector de variable**
   ```html
   <div class="controls-row">
     <h3 style="margin:0">Histórico multivariable</h3>
     <div class="radio-group">
       <label><input type="radio" name="varSelect" value="temperature" checked> Temperatura</label>
       <label><input type="radio" name="varSelect" value="humidity"> Humedad</label>
       <label><input type="radio" name="varSelect" value="co2"> CO2</label>
       <label><input type="radio" name="varSelect" value="LAeq"> Ruido</label>
       <label><input type="radio" name="varSelect" value="occupancy"> Aforo</label>
     </div>
     <select id="rangeSelect" class="input">
       <option value="1h">1h</option>
       <option value="6h">6h</option>
       <option value="24h" selected>24h</option>
       <option value="7d">7d</option>
     </select>
   </div>
   ```

2. **Implementar selector dinámico en center_detail.js**
   - Event listener en `document.querySelectorAll('input[name="varSelect"]')`
   - Regenerar gráfica al cambiar selección
   - Línea de referencia horizontal en umbral crítico según variable

---

## PASO 7 — Grafana no muestra nada

### Causa raíz

El iframe en center_detail.html y control_center.html no tiene `src` configurado, o Grafana bloquea embedding por X-Frame-Options.

### Ubicaciones exactas

**Frontend** [backend/templates/center_detail.html](backend/templates/center_detail.html#L45):
- **Línea 45**: `<iframe id="grafanaFrame" title="Grafana center"></iframe>` sin src

**Frontend** [backend/templates/control_center.html](backend/templates/control_center.html#L56):
- **Línea 56**: `<iframe id="adminGrafana" title="Grafana admin"></iframe>` sin src

**docker-compose.yml** (no leído, pero indicado en architecture.md):
- **FALTA**: Variable de entorno `GF_SECURITY_ALLOW_EMBEDDING=true`

### Solución concreta

1. **Agregar variable en docker-compose.yml**
   ```yaml
   grafana:
     image: grafana/grafana:latest
     ports:
       - "3000:3000"
     environment:
       - GF_SECURITY_ALLOW_EMBEDDING=true
       - GF_INSTALL_PLUGINS=grafana-piechart-panel
     volumes:
       - grafana_data:/var/lib/grafana
       - ./grafana/provisioning:/etc/grafana/provisioning
   ```

2. **Backend**: Crear endpoint `/api/grafana/center/{center_id}`
   ```python
   @app.route('/api/grafana/center/<center_id>', methods=['GET'])
   def grafana_center(center_id):
       # Construir URL iframe con dashboard específico
       dashboard_url = f"{GRAFANA_URL}/d/center-{center_id}?refresh=30s&kiosk=tv"
       return jsonify({"url": dashboard_url})
   ```

3. **Frontend JS**: Rellenar src del iframe
   ```javascript
   async function loadGrafana() {
     const url = await apiGet(`/api/grafana/center/${centerId}`);
     document.getElementById("grafanaFrame").src = url.url;
   }
   ```

4. **Fallback**: Si iframe bloqueado, mostrar botón "Abrir en Grafana"
   ```html
   <a id="grafanaLink" class="btn" href="#" target="_blank">Abrir en Grafana</a>
   ```

---

## PASO 8 — No se puede clicar en el detalle de cada sala

### Causa raíz

Los event listeners en las cards de sala se pierden cuando el DOM se regenera dinámicamente.

### Ubicaciones exactas

**Frontend JS** (backend/static/js/center_detail.js - NO LEÍDO):
- Falta: Delegación de eventos en contenedor padre
- Actual: Listeners directos en elementos que se reemplazan

### Solución concreta

1. **Usar delegación de eventos**
   ```javascript
   document.getElementById("roomsList").addEventListener("click", function(e) {
     const card = e.target.closest(".room-card");
     if (card) {
       const roomId = card.dataset.roomId;
       openRoomPanel(roomId);
     }
   });
   ```

2. **Marcar cards con atributo data**
   ```html
   <div class="room-card" data-room-id="urn:ngsi-ld:Room:muncyt-sala01">
     <!-- contenido -->
   </div>
   ```

---

## PASO 9 — Vista de Control completamente en blanco

### Causa raíz

Los endpoints `/api/admin/alerts` y `/api/admin/devices` no existen en backend, y las tablas no se populan con datos.

### Ubicaciones exactas

**Frontend** [backend/templates/control_center.html](backend/templates/control_center.html#L33):
- **Línea 33+**: Tabla `#alertsTableBody` vacía
- **Línea 40+**: Tabla `#devicesTableBody` vacía

**Backend** [backend/app.py](backend/app.py#L900+):
- **NO EXISTE**: `/api/admin/alerts`
- **NO EXISTE**: `/api/admin/devices`
- **NO EXISTE**: `/api/admin/alerts/stats`

### Solución concreta

#### Pestaña Alertas

1. **Crear endpoint `/api/admin/alerts`**
   ```python
   @app.route('/api/admin/alerts', methods=['GET'])
   def admin_alerts():
       alerts = alert_entities()
       center = request.args.get('center')
       alert_type = request.args.get('type')
       severity = request.args.get('severity')
       status = request.args.get('status')
       
       # Filtrar
       if center: alerts = [a for a in alerts if a.get("alertSource", "").startswith(f"urn:ngsi-ld:Room:{center}")]
       if alert_type: alerts = [a for a in alerts if a.get("subCategory") == alert_type]
       if severity: alerts = [a for a in alerts if a.get("severity") == severity]
       if status: alerts = [a for a in alerts if a.get("status") == status]
       
       return jsonify(alerts)
   ```

2. **Script de importación**: Crear alertas de prueba si no existen
   - Modificar [scripts/import_data.py](scripts/import_data.py) para generar 10+ alertas con distintos tipos/severidades

#### Pestaña Dispositivos

1. **Crear endpoint `/api/admin/devices`**
   ```python
   @app.route('/api/admin/devices', methods=['GET'])
   def admin_devices():
       devices = device_entities()
       # Agregar estado actual, batería, última lectura
       return jsonify(devices)
   ```

2. **Campos requeridos en tabla**:
   - Nombre dispositivo
   - Sala (derivada de `refPointOfInterest`)
   - Centro (derivada de sala → museo)
   - Tipo (controlledProperty)
   - Estado (deviceState badge: on/off/fault)
   - Batería (barra de progreso con color según nivel)
   - Última lectura (dateLastValueReported)
   - Badge "Mantenimiento próximo" si batería < 0.2

#### Pestaña Grafana

- Ver PASO 7

---

## PASO 10 — Actualizaciones en tiempo real cada 30 segundos

### Causa raíz

No existe emisión de eventos WebSocket desde Flask-SocketIO cuando llegan datos nuevos del simulador MQTT.

### Ubicaciones exactas

**Backend** [backend/app.py](backend/app.py#L900+):
- **NO EXISTE**: Endpoint `POST /notify` que reciba suscripciones de Orion
- **NO EXISTE**: Emisión de eventos SocketIO: `socketio.emit('update:kpi', ...)`

**Frontend JS** (común a todas las vistas):
- **FALTA**: Listener SocketIO `socket.on('update:kpi', ...)`
- **FALTA**: Indicador visual "En vivo" con punto parpadeante

### Solución concreta

1. **Implementar `/notify` en app.py**
   ```python
   @app.route('/notify', methods=['POST'])
   def notify():
       """Receptor de notificaciones Orion por suscripción."""
       payload = request.get_json() or {}
       data = payload.get("data", [])
       
       for entity in data:
           entity_type = entity.get("type")
           entity_id = entity.get("id")
           
           if entity_type == "IndoorEnvironmentObserved":
               socketio.emit('update:environment', {
                   "entity_id": entity_id,
                   "temperature": entity.get("temperature", {}).get("value"),
                   "humidity": entity.get("relativeHumidity", {}).get("value"),
                   "co2": entity.get("co2", {}).get("value"),
                   "timestamp": utc_now()
               }, broadcast=True)
           elif entity_type == "CrowdFlowObserved":
               socketio.emit('update:crowd', {
                   "entity_id": entity_id,
                   "occupancy": entity.get("occupancy", {}).get("value"),
                   "peopleCount": entity.get("peopleCount", {}).get("value"),
                   "timestamp": utc_now()
               }, broadcast=True)
           # ... más tipos
       
       clear_cached_queries()  # Invalidar cache
       return jsonify({"status": "ok"})
   ```

2. **Frontend**: Escuchar eventos SocketIO en common.js
   ```javascript
   socket.on('update:environment', (data) => {
     console.log('Actualización ambiente:', data);
     // Actualizar solo elementos afectados
   });
   
   socket.on('update:crowd', (data) => {
     console.log('Actualización aforo:', data);
   });
   ```

3. **Indicador "En vivo"**
   - Agregar a todas las vistas HTML:
     ```html
     <div id="liveIndicator" style="position:fixed;bottom:16px;right:16px;display:flex;align-items:center;gap:8px;font-size:12px;color:#0e7c74">
       <span style="width:8px;height:8px;background:#0e7c74;border-radius:50%;animation:pulse 1.5s infinite"></span>
       <span data-i18n="live">En vivo</span>
       <span id="lastUpdateTime">00:00:00</span>
     </div>
     ```
   - CSS para pulsación:
     ```css
     @keyframes pulse {
       0%, 100% { opacity: 1; }
       50% { opacity: 0.4; }
     }
     ```
   - Actualizar timestamp con cada evento recibido

---

## Criterios de Aceptación Obligatorios

- ✅ PASO 0: Diagnóstico completo, datos reales fluyendo extremo a extremo
- ✅ PASO 1: KPIs en dashboard muestran valores ≠ 0 con datos reales
- ✅ PASO 2: Diagrama Mermaid renderiza sin errores en Mermaid 10.9.5
- ✅ PASO 3: Aforo muestra porcentaje correcto (0-100%)
- ✅ PASO 4: Gráficas de temp y ocupación separadas con unidades propias
- ✅ PASO 5: Panel detalle de sala como modal fijo, no estira cards
- ✅ PASO 6: Selector de variable histórico con línea de umbral
- ✅ PASO 7: Grafana embebido visible o con fallback a botón "Abrir"
- ✅ PASO 8: Click en sala abre panel lateral (delegación de eventos)
- ✅ PASO 9: Tres pestañas Control muestran datos reales (alertas, dispositivos, Grafana)
- ✅ PASO 10: Indicador "En vivo" parpadeante, actualización cada 30s sin recargar página

---

## Notas Generales

- **Endpoints a crear**: ~8 nuevos (`/api/dashboard/summary`, `/api/centers`, `/api/centers/{id}/*`, `/api/model/graph`, `/api/admin/*`, `/notify`)
- **Funciones existentes a usar**: `center_snapshot()`, `room_latest_entities()`, `room_status()`, `series_for_room()`
- **Endpoints existentes (NO CREAR)**: Los helpers de Orion ya existen y son correctos
- **ML Models**: Ya entrenados en `fit_models()`, listos para usar en `refresh_artwork_risks()`
- **Database**: Orion/QuantumLeap/CrateDB ya funcionales (confirmar en PASO 0)
- **Docker**: Actualizar `docker-compose.yml` con variables de Grafana

---

**Siguiente**: Aguardando aprobación del usuario para proceder con implementación.
