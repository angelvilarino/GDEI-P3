# PRD — AuraVault

## 1. Objetivo de la aplicación

AuraVault es una plataforma FIWARE para la monitorización ambiental, la conservación preventiva del patrimonio cultural y el confort del público en espacios culturales de interior. La aplicación combina datos en tiempo real, históricos y predicción para ayudar a tres perfiles de usuario a tomar decisiones operativas y de conservación sobre centros culturales, salas, obras y dispositivos.

El sistema debe permitir:

- Supervisar el estado ambiental de varios centros culturales desde una vista global.
- Analizar el comportamiento de cada centro, sala y obra con históricos y alertas.
- Activar y supervisar actuadores cuando las condiciones superen umbrales de riesgo.
- Ofrecer una vista pública simplificada para visitantes mediante QR.
- Visualizar el estado ambiental mediante mapas, gráficos, dashboards y un gemelo digital 3D.

El producto se diseña para trabajar con NGSI-LD como modelo preferente, Orion Context Broker como fuente de datos actuales, QuantumLeap y CrateDB como capa histórica, IoT Agent JSON sobre MQTT para la integración con dispositivos, y Flask con Flask-SocketIO como backend de aplicación.

## 2. Alcance funcional

La aplicación cubre cuatro centros culturales de interior de A Coruña y su explotación operativa en un escenario realista de monitorización ambiental. El alcance funcional incluye:

- Visualización global de centros, salas, obras, sensores, alertas y actuadores.
- Consulta detallada de métricas ambientales por centro, sala y obra.
- Análisis temporal a corto, medio y largo plazo.
- Predicción de riesgo de degradación en obras y de fallo en dispositivos.
- Control de actuadores y respuesta ante condiciones críticas.
- Exportación de informes de conservación y consulta pública para visitantes.

La aplicación se centra en la trazabilidad semántica entre centro, sala, obra, sensor, observación, alerta y actuador. No se limita a mostrar series temporales: debe convertir los datos ambientales en decisiones operativas y visualizaciones comprensibles para cada rol.

## 3. Estado del arte y contexto de uso

Las soluciones de monitorización ambiental para museos y teatros han evolucionado desde sistemas cerrados de BMS hacia arquitecturas IoT interoperables. Las alternativas comerciales suelen cubrir adquisición de datos, alarmas por umbral y reporting, pero normalmente presentan limitaciones de interoperabilidad, semántica y conexión entre el dato ambiental y el activo cultural afectado.

AuraVault se diferencia al unir:

- Estándares FIWARE y NGSI-LD para interoperabilidad.
- Modelo explícito de relación entre salas, obras, dispositivos y actuadores.
- Control ambiental y conservación preventiva en una única aplicación.
- Capas de visualización heterogéneas: mapa, dashboard, tablas, gráficos, 3D y vista pública.

El producto se orienta a museos y teatros de interior, donde coexisten necesidades de conservación, confort, acústica y ocupación variable.

## 4. Roles de usuario

### 4.1 Gestor

Perfil con visión global del edificio y capacidad de supervisión operativa.

Puede:

- Ver el estado agregado de todos los centros.
- Consultar indicadores globales, alertas activas y tendencias.
- Comparar centros entre sí por ocupación, confort y riesgo.
- Acceder a mapas, dashboards y vistas resumidas.
- Resolver alertas y validar acciones operativas.
- Ver el estado de sensores y actuadores a nivel de flota.

No puede:

- Editar fichas técnicas de obras.
- Modificar requisitos de conservación de cada obra.
- Exponer información privada o técnica al modo visitante.

### 4.2 Conservador

Perfil técnico centrado en salas, obras y condiciones de conservación.

Puede:

- Analizar el estado de cada sala y cada obra.
- Consultar históricos ambientales, alertas y riesgos acumulados.
- Revisar comparativas entre obras.
- Generar el pasaporte ambiental de una sala.
- Interpretar recomendaciones de actuación sobre actuadores.
- Ver la evolución de la condición de conservación de materiales sensibles.

No puede:

- Cambiar la estructura de despliegue de centros.
- Editar la configuración global de la aplicación.

### 4.3 Visitante

Perfil público y simplificado, orientado a consulta por QR desde móvil.

Puede:

- Ver el estado ambiental resumido de una sala o centro.
- Consultar si las condiciones actuales son buenas, aceptables o mejorables.
- Ver la ocupación aproximada y el confort general.
- Recibir una recomendación de sala con mejores condiciones en ese momento.

No puede:

- Ver datos técnicos detallados de sensores o obras.
- Interactuar con funciones administrativas.
- Ver alertas internas o información sensible.

## 5. Centros culturales de interior

La plataforma monitoriza estos cuatro centros culturales, todos de interior y situados en A Coruña.

### 5.1 MUNCYT — Museo Nacional de Ciencia e Tecnoloxía

- Coordenadas: 43.3731638, -8.4203453
- Dirección de referencia: Plaza del Museo Nacional de Ciencia, 1, A Coruña, Galicia, España
- Descripción: museo científico y tecnológico con piezas técnicas, salas temáticas y necesidades de control especialmente sensible en humedad, temperatura y estabilidad ambiental. El edificio requiere lectura de ocupación y vigilancia de cambios bruscos en salas con equipamiento o piezas delicadas.

### 5.2 Museo de Bellas Artes de A Coruña

- Coordenadas: 43.3727883, -8.3996578
- Dirección de referencia: Calle Zalaeta, 2, 15002 A Coruña, Galicia, España
- Descripción: pinacoteca con pintura española y europea, colecciones de materiales diversos y requisitos de conservación estrictos. El control de humedad, iluminación y temperatura debe priorizar estabilidad y minimizar oscilaciones.

### 5.3 Teatro Rosalía de Castro

- Coordenadas: 43.3702205, -8.3985089
- Dirección de referencia: Calle Riego de Agua, 37, A Coruña, Galicia, España
- Descripción: teatro histórico con variaciones intensas de ocupación, cambios térmicos por función y exigencia acústica elevada. El control de CO2, ruido, temperatura y aforo es crítico durante accesos, funciones y descansos.

### 5.4 Palacio de la Ópera

- Coordenadas: 43.3631533, -8.4109463
- Dirección de referencia: Rúa Uruguai, 2A, A Coruña, Galicia, España
- Descripción: sala de conciertos moderna con foco en confort del público, control acústico y comportamiento ambiental durante eventos. La aplicación debe contemplar picos de ocupación y escenarios de uso intensivo de iluminación y climatización.

## 6. Modelo de datos conceptual de producto

La aplicación trabaja con entidades FIWARE y entidades propias relacionadas semánticamente:

- Museum
- IndoorEnvironmentObserved
- NoiseLevelObserved
- CrowdFlowObserved
- Device
- DeviceModel
- Alert
- Room
- Artwork
- Actuator

Relaciones principales esperadas:

- Museum contiene Room.
- Room está ubicada en Museum.
- Room expone Artwork.
- Room aloja Device y Actuator.
- Device referencia DeviceModel.
- Observaciones ambientales referencian Device y sala o centro.
- Alert nace de una fuente concreta y se asocia a un contexto operativo.
- Actuator se controla mediante Device y actúa sobre una Room.

El detalle de atributos, relaciones y clasificación de campos estática o dinámica se reserva para data_model.md.

## 7. Funcionalidades principales

- Monitorización ambiental en tiempo real de centros, salas, obras y dispositivos.
- Visualización global de estado ambiental y ocupación.
- Navegación geográfica y exploración de centros.
- Consulta de detalle de centro con históricos, alertas y actuadores.
- Gemelo digital 3D interactivo por sala y variable ambiental.
- Consulta detallada de salas y obras con riesgo de conservación.
- Comparación de obras para priorización conservadora.
- Generación de pasaporte ambiental de sala.
- Centro de control para alertas, dispositivos y dashboards.
- Modo visitante público con lectura simplificada y recomendación de sala.
- Chatbot contextual para visitante con LLM local y contexto NGSI-LD de sala y obras.
- Predicción de degradación de obras y fallo de sensores.
- Respuesta automática o manual mediante actuadores.

## 8. Requisitos funcionales por vista

### 8.1 Vista 1 — Dashboard Global

Objetivo: ofrecer una visión consolidada de todos los centros culturales para el Gestor.

Datos que muestra:

- KPIs globales de ocupación, confort y riesgo.
- Número de centros en estado óptimo, de atención o crítico.
- Número de obras en riesgo.
- Estado agregado de sensores activos frente al total.
- Alertas activas por severidad.
- Comparativa temporal del comportamiento ambiental global.
- Mapa de ubicación de los cuatro centros.


Interacciones que permite:

- Navegar al detalle de cada centro desde el mapa o las tarjetas.
- Filtrar o explorar alertas activas.
- Resolver una alerta desde el panel lateral.
- Cambiar el rango temporal del gráfico agregado.
- Expandir o contraer el diagrama del modelo de datos.


Tecnologías que usa:

- Leaflet y OpenStreetMap para el mapa.
- Chart.js para el gráfico temporal.
- WebSocket para KPIs y alertas en tiempo real.
- Mermaid para el diagrama plegable del modelo.
- HTML, CSS y JavaScript para la composición de la interfaz.


Endpoints del backend necesarios:

- GET /api/dashboard/summary
- GET /api/centers
- GET /api/alerts/active
- PATCH /api/alerts/{alert_id}/resolve
- GET /api/metrics/global?range={range}
- GET /api/model/graph
- GET /api/centers/{center_id}


### 8.1.1 Estado de implementación

- El backend aplica caché de corta duración para consultas frecuentes y reduce la carga sobre Orion.
- Cuando no hay datos actuales, las vistas recurren a histórico reciente desde QuantumLeap.
- Las tarjetas, gráficas y paneles evitan mostrar ceros artificiales en ausencia de información.
- La navegación global incluye mapa con hover y acceso directo al detalle de centro.
- El gemelo 3D y la vista de sala usan paneles laterales para lecturas y selección contextual.
- La vista de centros añade búsqueda textual y filtros combinados.
- La interfaz se mantiene bilingüe en español e inglés con traducción de labels y placeholders.
- **Sincronización en tiempo real (15s)**: Implementada mediante hilos de fondo en el backend y eventos SocketIO para KPIs, alertas y estado de dispositivos.
- **Suscripciones NGSI-LD**: El sistema gestiona automáticamente las suscripciones en Orion-LD para recibir eventos proactivos.
### 8.2 Vista 2 — Explorador de Centros

Objetivo: permitir descubrir y comparar rápidamente los cuatro centros.

Datos que muestra:

- Tarjetas con imagen, nombre, tipo de centro y estado ambiental.
- Temperatura, humedad y CO2 actuales.
- Aforo estimado o actual.
- Indicador de ocupación y color de estado.
- Sparkline de evolución de la última hora.

Interacciones que permite:

- Filtrar por tipo de centro.
- Filtrar por estado ambiental.
- Filtrar por nivel de ocupación.
- Abrir el detalle de un centro.
- Ordenar centros según estado o riesgo.

Tecnologías que usa:

- CSS responsive con grid y cards.
- Chart.js para las sparklines.
- JavaScript para filtros y ordenación.
- WebSocket o polling corto para refresco de valores.

Endpoints del backend necesarios:

- GET /api/centers
- GET /api/centers?type={type}&status={status}&occupancy={occupancy}
- GET /api/centers/{center_id}/snapshot
- GET /api/centers/{center_id}/trend?range=1h

### 8.3 Vista 3 — Detalle del Centro

Objetivo: centralizar la explotación operativa y conservadora de un centro concreto.

Datos que muestra:

- Gauges en tiempo real de temperatura, humedad, CO2, ruido y aforo.
- Lista de salas del centro con estado y ocupación.
- Lista de obras en riesgo ordenadas por prioridad.
- Histórico multivariable por rango temporal.
- Panel embebido de Grafana.
- Estado de actuadores disponibles en el centro.

Interacciones que permite:

- Cambiar el rango temporal del histórico.
- Entrar en el detalle de una sala o una obra.
- Activar o desactivar un actuador cuando el sistema lo permita.
- Lanzar un comando de control a un actuador.
- Consultar el histórico completo en Grafana.

Tecnologías que usa:

- Chart.js para gauges y series temporales.
- Grafana embebido para observación avanzada.
- WebSocket para valores en vivo y estado de actuadores.
- Integración con FIWARE para consultar entidades y observaciones.

Endpoints del backend necesarios:

- GET /api/centers/{center_id}
- GET /api/centers/{center_id}/rooms
- GET /api/centers/{center_id}/artworks/at-risk
- GET /api/centers/{center_id}/history?range={range}
- GET /api/centers/{center_id}/actuators
- POST /api/actuators/{actuator_id}/command
- GET /api/grafana/center/{center_id}

### 8.4 Vista 4 — Gemelo Digital 3D

Objetivo: representar el edificio y sus salas como un espacio 3D interactivo para inspección ambiental avanzada.

Datos que muestra:

- Geometría del centro y sus salas como volúmenes 3D.
- Coloración dinámica de salas según variable ambiental seleccionada.
- Sensores y dispositivos posicionados dentro de cada sala.
- Partículas o animaciones que representen el flujo de personas.
- Panel lateral con lecturas de la sala seleccionada.
- Lista de obras presentes en la sala y su riesgo.

Interacciones que permite:

- Rotar, desplazar y hacer zoom sobre la escena.
- Seleccionar una sala para abrir su panel de detalle.
- Cambiar la variable visualizada entre temperatura, CO2, humedad, ruido y aforo.
- Activar una simulación de propagación ambiental cuando un actuador entra en funcionamiento.
- Consultar datos actuales sin recargar la escena.

Tecnologías que usa:

- Three.js para la escena 3D.
- WebSocket para actualización automática.
- JavaScript para interacción y selección de objetos 3D.
- Chart.js en el panel lateral cuando se muestre un histórico resumido.

Endpoints del backend necesarios:

- GET /api/centers/{center_id}/3d-scene
- GET /api/centers/{center_id}/rooms/{room_id}
- GET /api/rooms/{room_id}/environment/current
- GET /api/rooms/{room_id}/artworks
- GET /api/devices?room_id={room_id}
- GET /api/rooms/{room_id}/connections
- POST /api/simulations/spread
- GET /api/stream/updates

### 8.5 Vista 5 — Detalle de Sala y Detalle de Obra

Objetivo: ofrecer al Conservador una lectura fina del estado ambiental y del impacto sobre cada sala y cada obra.

Datos que muestra en el detalle de sala:

- Gauges de todos los sensores de la sala.
- Comparativa entre condiciones actuales y rangos óptimos según el material más sensible presente.
- Tabla de obras expuestas en esa sala.
- Histórico ambiental multivariable por fecha o rango.
- Resumen de alertas y tendencia ambiental.

Datos que muestra en el detalle de obra:

- Ficha técnica de la obra.
- Condiciones actuales frente a condiciones ideales.
- Índice de riesgo de degradación.
- Estrés térmico acumulado.
- Línea de tiempo de alertas relacionadas.

Interacciones que permite:

- Cambiar el rango temporal o la fecha de consulta.
- Abrir una obra desde la tabla de sala.
- Comparar varias obras en una vista lado a lado.
- Exportar el pasaporte ambiental de la sala.
- Navegar entre obras relacionadas.

Tecnologías que usa:

- Chart.js para gauges, radar, barras y líneas temporales.
- Exportación a PDF o Markdown para el pasaporte ambiental.
- JavaScript para selección múltiple y comparativa de obras.
- QuantumLeap como fuente de histórico.
- scikit-learn para el cálculo del riesgo de degradación.

Endpoints del backend necesarios:

- GET /api/rooms/{room_id}
- GET /api/rooms/{room_id}/environment/current
- GET /api/rooms/{room_id}/history?range={range}
- GET /api/rooms/{room_id}/artworks
- GET /api/artworks/{artwork_id}
- GET /api/artworks/{artwork_id}/history?range={range}
- GET /api/artworks/{artwork_id}/alerts
- GET /api/artworks/compare?ids={id1},{id2},{id3}
- GET /api/rooms/{room_id}/passport?format={pdf|md}

### 8.6 Vista 6 — Centro de Control

Objetivo: dar al Gestor una consola administrativa para alertas, dispositivos y observación técnica.

Datos que muestra en la pestaña de alertas:

- Tabla de alertas filtrable por centro, tipo, severidad, estado y fechas.
- Estadísticas agregadas por tipo y por centro.

Datos que muestra en la pestaña de dispositivos:

- Tabla de dispositivos con estado, batería, última lectura y latencia.
- Indicadores de mantenimiento próximo o riesgo de fallo.

Datos que muestra en la pestaña Grafana:

- Dashboards embebidos para series temporales, comparativas, mapas de calor y estado de la flota.

Interacciones que permite:

- Filtrar alertas por criterios múltiples.
- Resolver alertas desde la tabla.
- Revisar el detalle de un dispositivo.
- Consultar predicciones de fallo.
- Abrir dashboards específicos por centro o por métrica.

Tecnologías que usa:

- Tablas HTML dinámicas.
- Chart.js para estadísticas de alertas.
- Grafana embebido.
- scikit-learn para predicción de fallo de dispositivos.
- WebSocket para actualización de alertas y estado de sensores.

Endpoints del backend necesarios:

- GET /api/admin/alerts
- GET /api/admin/alerts/stats
- PATCH /api/alerts/{alert_id}/resolve
- GET /api/admin/devices
- GET /api/devices/{device_id}
- GET /api/devices/{device_id}/prediction
- GET /api/grafana/admin

### 8.7 Vista 7 — Modo Visitante

Objetivo: mostrar al visitante una lectura pública, clara y simplificada del estado ambiental.

Datos que muestra:

- Estado simple del aire con calificación textual.
- CO2 actual.
- Temperatura y humedad.
- Aforo o nivel de concurrencia.
- Recomendación de la sala con mejores condiciones en ese momento.
- Widget de chat para preguntas sobre la sala y obras expuestas.

Interacciones que permite:

- Consultar la vista desde móvil mediante QR.
- Refrescar el contenido automáticamente.
- Navegar entre la información resumida del centro y la sala recomendada.
- Enviar preguntas en lenguaje natural al asistente del visitante.
- Recibir respuestas contextuales en español o inglés basadas en datos actuales.

Tecnologías que usa:

- HTML responsive adaptado a móvil.
- CSS específico para lectura rápida.
- JavaScript con refresco periódico.
- WebSocket o polling controlado según el despliegue.
- Flask para orquestación del chat y construcción de contexto.
- LLM local vía API (preferente Gemma).

Endpoints del backend necesarios:

- GET /visitor/{poi_id}
- GET /api/public/poi/{poi_id}
- GET /api/public/poi/{poi_id}/summary
- GET /api/public/poi/{poi_id}/recommended-room
- GET /api/public/poi/{poi_id}/rooms
- POST /api/public/chat/context
- POST /api/public/chat/ask

## 9. Requisitos funcionales transversales

- El sistema debe mostrar datos actuales, históricos y derivados de las entidades del dominio.
- El sistema debe distinguir claramente entre centro, sala, obra, sensor, alerta y actuador.
- El sistema debe actualizar la información relevante sin recargar la página cuando sea posible.
- El sistema debe permitir navegar desde una vista agregada hasta el nivel de sala y obra.
- El sistema debe calcular y exponer un riesgo de degradación para cada obra.
- El sistema debe generar recomendaciones de sala para visitantes a partir del estado ambiental actual.
- El sistema debe permitir consultas conversacionales del visitante sobre sala y obras usando contexto NGSI-LD actualizado.
- El sistema debe permitir exportar el pasaporte ambiental de una sala.
- El sistema debe permitir comparar varias obras en paralelo.
- El sistema debe permitir activar actuadores cuando se superen umbrales críticos.

## 10. Requisitos no funcionales

- Latencia en tiempo real por WebSocket inferior a 2 segundos entre actualización de datos y visualización.
- Interfaz responsive para móvil, tablet y escritorio.
- Soporte bilingüe español e inglés en toda la interfaz pública y privada.
- Modo visual Dark y Light con persistencia de preferencia de usuario.
- La interfaz visitante debe ser legible en pantallas pequeñas sin necesidad de zoom.
- La respuesta del chatbot visitante debe entregarse en menos de 4 segundos en condiciones normales de red local.
- La aplicación debe mantenerse operativa con múltiples fuentes de datos simultáneas.
- La solución debe ser compatible con despliegue en contenedores Docker.
- Las visualizaciones deben priorizar legibilidad y rendimiento sobre animaciones ornamentales.

## 11. Stack tecnológico completo

### 11.1 Capa de contexto y datos

- Orion Context Broker con NGSI-LD para datos actuales.
- MongoDB como base de datos de contexto de Orion.
- QuantumLeap para extracción y consulta de históricos.
- CrateDB como base analítica temporal.

### 11.2 Capa IoT

- IoT Agent JSON.
- MQTT como protocolo de mensajería.
- Mosquitto como broker MQTT.

### 11.3 Backend de aplicación

- Flask.
- Flask-SocketIO.
- API REST para consulta y control.
- Endpoint de notificación para suscripciones.
- Orquestación de prompts y llamadas a LLM local para el chatbot visitante.

### 11.4 Frontend y visualización

- HTML.
- CSS.
- JavaScript.
- Leaflet y OpenStreetMap.
- Chart.js.
- Three.js.
- Grafana embebido.

### 11.5 Analítica y datos

- scikit-learn.
- Pandas.
- Polars.

### 11.6 IA conversacional

- LLM local vía API (Gemma preferente).
- Prompt de sistema controlado por backend.

### 11.7 Despliegue

- Docker.
- Docker Compose.

## 12. Suposiciones de producto

- Cada centro dispone de al menos seis salas.
- Cada sala puede tener varias obras, sensores y al menos un contexto de control ambiental.
- Las relaciones entre entidades se modelan con referencias NGSI-LD.
- El histórico ambiental se consulta principalmente desde QuantumLeap y el estado actual desde Orion.
- El visitante accede a una vista pública reducida y no necesita autenticación.
- El chatbot visitante usa solo contexto de sala y obra disponible en Orion y no accede a datos personales.

## 13. Criterios de aceptación del PRD

- Las 7 vistas quedan definidas con datos, interacciones, tecnologías y endpoints.
- Los cuatro centros culturales quedan identificados con coordenadas reales y descripción operativa.
- Los tres roles quedan delimitados por permisos y responsabilidades.
- Los requisitos no funcionales quedan cerrados y medibles.
- El stack tecnológico queda totalmente alineado con Project_Rules.md.
- No existe ambigüedad sobre qué entidades, métricas y visualizaciones forman parte del producto.
