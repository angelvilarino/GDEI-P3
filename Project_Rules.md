# AuraVault — Inteligencia Ambiental para Espacios Culturales de Interior

## Qué es
Una plataforma de inteligencia ambiental diseñada específicamente para museos y teatros de interior. No es solo un monitor de sensores; es un sistema de **conservación preventiva del patrimonio cultural** y de **confort del público**, capaz de detectar riesgos antes de que ocurran, activar actuadores de forma autónoma y predecir el comportamiento ambiental futuro de cada sala. Permite tres roles: **Gestor** (visión global del edificio), **Conservador** (custodia técnica de obras y salas) y **Visitante** (consulta pública de salud ambiental vía QR).

La aplicación utiliza **NGSI-LD** como estándar preferente sobre **Orion Context Broker** para datos actuales, **QuantumLeap y CrateDB** para históricos, e **IoT Agent JSON sobre MQTT** para la comunicación con dispositivos. Incorpora visualizaciones inmersivas con **Three.js**, análisis predictivo mediante **scikit-learn**, procesamiento de datos con **Pandas/Polars** y notificaciones en tiempo real con **Flask-SocketIO**.

---

## Escenario Real: Centros Culturales de Interior

La aplicación monitoriza cuatro espacios culturales emblemáticos, todos de interior:

* **Museo Nacional de Ciencia y Tecnología (MUNCYT)** — museo con salas temáticas y piezas técnicas sensibles a la humedad.
* **Museo de Bellas Artes de A Coruña** — museo con obras de arte en lienzo, madera y mármol con requisitos de conservación estrictos.
* **Teatro Rosalía de Castro** — teatro histórico con aforo elevado y variaciones térmicas intensas durante las funciones.
* **Palacio de la Ópera** — sala de conciertos moderna con control acústico y ambiental de alta exigencia.

---

## Smart Data Models Usados (NGSI-LD)

| Modelo | Dominio | Uso en AuraVault |
| :--- | :--- | :--- |
| **Museum** | PointOfInterest | Definición de museos y teatros con metadatos estáticos. |
| **IndoorEnvironmentObserved** | Environment | Núcleo del sistema: temperatura, humedad, CO2, iluminancia, presión atmosférica y peopleCount por sala. |
| **NoiseLevelObserved** | Environment | Control de niveles de ruido en salas de exposición y durante funciones (LAeq, LAmax, LAmin). |
| **CrowdFlowObserved** | Transportation | Aforo por sala: peopleCount, direction (inbound/outbound), congested. |
| **Device / DeviceModel** | Device | Gestión de sensores: estado, batería, latencia, tipo (temperatura/CO2/ruido/aforo). |
| **Alert** | CrossSector | Alertas NGSI-LD por riesgo de degradación, exceso de CO2, ruido, aforo o fallo de sensor. |

### Entidades custom relacionadas mediante Relationships NGSI-LD
* **Room** (sala) → `isLocatedIn` → Museum / PointOfInterest
* **Artwork** (obra de arte) → `isExposedIn` → Room
* **Actuator** (deshumidificador, HVAC, ventilación) → `isLocatedIn` → Room; `isControlledBy` → Device

---

## Las 7 Vistas de la Aplicación

### Vista 1 — Dashboard Global (Cultural Pulse)
Pantalla de aterrizaje para el Gestor.

* **Cards de KPIs en tiempo real** (WebSocket): visitantes totales en todos los centros, % de salas en rango óptimo, número de obras en estado "atRisk" o "critical", sensores activos vs. total.
* **Mapa Leaflet/OSM** con los 4 centros culturales: marcadores con color según estado ambiental actual, popup al hover con imagen del centro y resumen de indicadores, navegación al detalle al pulsar.
* **Gráfico Chart.js central**: comparativa de aforo vs. temperatura media de todos los centros en las últimas 12 horas. Dos ejes Y, líneas de colores distintos por centro.
* **Panel lateral de alertas** (WebSocket): lista scrollable de `Alert` NGSI-LD activas con código de color por severidad. Botón "Resolver" que hace PATCH a Orion actualizando `status: resolved`.
* **Diagrama UML Mermaid** del modelo de datos completo, plegable.

### Vista 2 — Explorador de Centros (Catálogo)
* **Grid de cards** responsive con filtros por: tipo (museo/teatro), estado ambiental (óptimo/atención/crítico), nivel de ocupación (libre/moderado/congestionado).
* Cada card muestra imagen real, nombre, tipo, estado con badge de color, temperatura/humedad/CO2 actuales, aforo con barra de progreso, y una **sparkline Chart.js** de la evolución de la última hora.

### Vista 3 — Detalle del Centro
* **Gauges en tiempo real** (Chart.js): temperatura, humedad relativa, CO2, ruido (NoiseLevelObserved LAeq), aforo.
* **Iconos de temperatura y humedad** con colores según umbrales críticos por tipo de centro.
* **Feedback Loop de Actuadores**: si el CO2 supera 1200 ppm o la humedad sale del rango de conservación, se muestra un botón que envía un comando al IoT Agent para activar el Actuator correspondiente en Orion. El estado del actuador se refleja en tiempo real.
* **Lista de salas** del centro con badge de estado, aforo actual y enlace al detalle.
* **Lista de obras en riesgo** del centro (degradationRisk > 0.5), ordenadas por riesgo.
* **Histórico Chart.js** multi-variable con selector de rango (1h / 6h / 24h / 7d), datos de QuantumLeap.
* **Dashboard Grafana embebido** (iframe) con el histórico completo del centro.

### Vista 4 — Gemelo Digital 3D (Three.js)
La vista más innovadora e inmersiva de la aplicación.

* **Escena 3D** del edificio: cada sala es un volumen independiente que cambia de color dinámicamente según la variable seleccionada (temperatura, CO2, humedad, ruido, aforo).
* **Selector de capa visual**: toggle entre las distintas variables ambientales.
* **Sensores como objetos 3D**: los Device aparecen posicionados dentro de cada sala como iconos 3D interactivos.
* **Partículas animadas** que representan el movimiento de visitantes (basadas en CrowdFlowObserved).
* **Click en una sala**: zoom suave con animación hacia la sala seleccionada y apertura de un panel lateral con todos los IndoorEnvironmentObserved en tiempo real y la lista de obras con su índice de riesgo.
* **Actualización automática via WebSocket** sin recargar la escena.
* **FUNCIONALIDAD ORIGINAL — Simulación de Propagación Ambiental**: al activar un actuador (ventilación, HVAC), la escena 3D muestra una animación de cómo se propaga el cambio de temperatura o CO2 por las salas adyacentes, basándose en un modelo simplificado de difusión. Las salas conectadas cambian de color gradualmente en cascada, visualizando el efecto del actuador en el tiempo.

### Vista 5 — Detalle de Sala y Detalle de Obra
**Detalle de Sala:**

* **Gauges en tiempo real** de todos los sensores de esa sala.
* **Gráfico Radar Chart.js**: comparativa entre las condiciones ambientales actuales y los rangos óptimos de conservación del material más delicado presente en la sala. 5 ejes: temperatura, humedad, CO2, iluminancia, ruido.
* **Tabla de obras** con imagen, nombre, artista, material, condición actual vs. requerida, índice de riesgo y estrés acumulado.
* **Histórico multi-variable** con selector de fecha (QuantumLeap → Chart.js).
* **FUNCIONALIDAD ORIGINAL — Pasaporte Ambiental de Sala**: exportación automática de un informe PDF/Markdown generado con los datos históricos de QuantumLeap resumiendo las condiciones ambientales medias, picos, alertas y tendencias de los últimos 30 días. Útil para auditorías de conservación y memorias anuales.

**Detalle de Obra:**

* Ficha técnica: imagen, nombre, artista, año, material, técnica, origen, conservationRequirements.
* **Gráfico Radar** de condiciones actuales vs. ideales para esa obra específica.
* **Gauge de degradationRisk** (0–1, scikit-learn): índice calculado como desviación media ponderada de las condiciones de su sala respecto a sus conservationRequirements, normalizada entre 0 y 1.
* **Índice de Estrés Térmico Acumulado**: gráfico de barras Chart.js con el estrés día a día en el último mes. Días con alertas marcados con punto rojo.
* **Línea de tiempo de alertas** relacionadas con esa obra en el último mes.
* **FUNCIONALIDAD ORIGINAL — Comparador de Obras**: botón que permite seleccionar hasta 3 obras y comparar simultáneamente sus índices de riesgo, historial de alertas y condiciones actuales vs. ideales en una vista de comparación lado a lado. Útil para que el conservador priorice qué obras necesitan atención urgente.

### Vista 6 — Centro de Control (Admin)
Tres tabs:

**Tab Alertas:**
Tabla de `Alert` NGSI-LD con filtros por centro, tipo (CO2Exceeded, HumidityOutOfRange, NoiseExceeded, CrowdingDetected, ArtworkAtRisk, DeviceFailurePredicted), severidad, estado y rango de fechas. Estadísticas con gráfico de barras Chart.js de distribución de alertas por tipo y por centro.

**Tab Dispositivos:**
Tabla de Device con estado, nivel de batería (barra de progreso), última lectura, latencia media. **Mantenimiento predictivo**: badge "Mantenimiento próximo" si el modelo ML predice fallo en los próximos 7 días basándose en la degradación histórica de batería y latencia (QuantumLeap → scikit-learn).

**Tab Grafana:**
Dashboards Grafana embebidos: histórico de series temporales por centro, comparativas entre centros, heatmap de alertas por hora del día, evolución del estado de la flota de sensores.

### Vista 7 — Modo Visitante (QR Público)
Accesible desde `http://localhost:5000/visitor/<poi_id>`. Sin navbar, diseño limpio y grande para móvil.

* Estado del aire con color e indicador textual simple ("El aire en esta sala es excelente / aceptable / mejorable").
* CO2 actual con escala visual, temperatura, humedad, aforo ("Sala tranquila / Moderadamente concurrida / Muy concurrida").
* **FUNCIONALIDAD ORIGINAL — Recomendación de Sala**: basándose en los datos actuales de IndoorEnvironmentObserved de todas las salas del mismo centro, el sistema sugiere al visitante qué sala tiene las mejores condiciones ambientales en ese momento ("La Sala de Escultura tiene ahora el mejor ambiente para visitar"). Implementado con una comparación simple de índices de confort entre salas.
* Actualización automática cada 60 segundos. Completamente responsive.

---

## Funcionalidades Originales Destacadas

1. **Simulación de Propagación Ambiental (3D)**: visualización en Three.js de cómo un actuador afecta a las salas adyacentes en cascada.
2. **Pasaporte Ambiental de Sala**: informe exportable PDF/Markdown con el historial ambiental de los últimos 30 días para auditorías de conservación.
3. **Comparador de Obras**: vista lado a lado de hasta 3 obras con sus índices de riesgo e historial de alertas.
4. **Recomendación de Sala para Visitantes**: el sistema sugiere en tiempo real qué sala del centro tiene las mejores condiciones ambientales para visitar en ese momento.
5. **Feedback Loop de Actuadores**: la app no solo monitoriza, sino que envía comandos a actuadores virtuales via IoT Agent cuando se superan umbrales críticos.

---

## Stack Tecnológico Completo

| Capa | Tecnología |
| :--- | :--- |
| Context Broker | Orion CB (NGSI-LD) |
| Históricos | QuantumLeap + CrateDB |
| IoT | IoT Agent JSON + Mosquitto (MQTT) |
| Backend | Flask + Flask-SocketIO |
| Frontend | HTML + CSS + JS |
| Mapas | Leaflet / OSM |
| Gráficos | Chart.js |
| 3D | Three.js |
| Dashboards | Grafana |
| ML | scikit-learn + Pandas/Polars |
| Contenedores | Docker + Docker Compose |

---

## Hoja de Ruta de Implementación (Conversaciones con el Agente)

### Conversación 1 — Estudio del dominio y modelado
Estudiar en profundidad los smart data models `IndoorEnvironmentObserved`, `NoiseLevelObserved`, `CrowdFlowObserved`, `Museum`, `Device` y `Alert` desde el repositorio https://github.com/smart-data-models. Extraer atributos completos en formato NGSI-LD, distinguir estáticos de dinámicos (IoT), y definir las Relationships entre Room, Artwork, Actuator y las entidades principales. Redactar el estado del arte de aplicaciones similares.

### Conversación 2 — Documentación técnica (PRD, data_model, architecture)
Con el agente en modo Plan, construir `PRD.md`, `data_model.md` y `architecture.md` a partir de este documento. El `data_model.md` debe incluir todos los atributos de cada entidad en formato NGSI-LD, indicando cuáles son dinámicos (actualizados por IoT) y las Relationships. El `architecture.md` debe incluir el diagrama Mermaid con todos los componentes y flujos de datos. Crear el repositorio en GitHub.

### Conversación 3 — MVP completo
Con el agente en modo Plan, elaborar el plan de implementación completo del MVP. Tras aprobarlo, implementar en una sola pasada:
- `docker-compose.yml` con Orion, MongoDB, QuantumLeap, CrateDB, Grafana, Mosquitto, IoT Agent JSON.
- `start.sh` y `stop.sh`.
- Script `import-data` que cargue en Orion los 4 centros, sus salas (al menos 6 por centro), 20 obras de arte, todos los Device y DeviceModel, y genere 30 días de histórico en QuantumLeap.
- Simulador IoT realista que publique via MQTT cada 30 segundos con variaciones de temperatura (+0.5°C por cada 10 visitantes), humedad (-1% por cada 10 visitantes), CO2 (+50 ppm por cada 10 visitantes) y ruido (+2 dB si aforo > 20).
- Backend Flask completo con todas las rutas, API REST, endpoint `/notify` para suscripciones Orion, Flask-SocketIO.
- Suscripciones Orion a QuantumLeap y al endpoint `/notify`.
- Modelo ML de scikit-learn para `degradationRisk` de obras y predicción de fallo de sensores.
- Toda la interfaz web con las 7 vistas descritas.
- Dashboards Grafana preconfigurados.
- `APPLICATION.md` (máx. 3 páginas).
