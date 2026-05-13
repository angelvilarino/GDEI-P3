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
- Chatbot flotante contextual para visitante (AuraBot) con Gemini API y contexto en tiempo real de sala, obras y métricas ambientales.
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
- **Sincronización en tiempo real (30s)**: Implementada mediante hilos de fondo en el backend y eventos SocketIO para KPIs, alertas y estado de dispositivos. La vista de explorador de centros incorpora refresco periódico (fetch) cada 30 segundos para asegurar la actualización de gráficas sparkline y aforo; el simulador MQTT publica también cada 30 segundos.
- **Suscripciones NGSI-LD**: El sistema gestiona automáticamente las suscripciones en Orion-LD para recibir eventos proactivos.
- **Glassmorphism global (issue #17)**: Se ha aplicado un sistema de diseño glassmorphism consistente en toda la aplicación mediante un único fichero CSS global (style.css). El fondo de cada página usa un gradiente oscuro con blobs decorativos. Todas las tarjetas, paneles, modales, inputs y la navbar usan `backdrop-filter: blur`, bordes semitransparentes y sombras suaves. El modo oscuro intensifica el efecto (menos opacidad, más blur); el modo claro lo suaviza. Texto en colores claros sobre fondo oscuro para garantizar legibilidad.
- **Imágenes de obras (issue #17)**: Todas las URLs de imágenes de las 24 obras en Orion han sido verificadas. Las 8 que usaban `Special:FilePath` de Wikimedia con rate-limiting han sido actualizadas a URLs directas de `upload.wikimedia.org` con thumbnails de 960px.
- **Vista 3 sin Grafana**: La tarjeta de Grafana embebido ha sido eliminada del detalle de centro. La tarjeta de control avanzado se mantiene en el Centro de Control (Vista 6).
### 8.2 Vista 2 — Explorador de Centros

Objetivo: permitir descubrir y comparar rápidamente los cuatro centros.

Datos que muestra:

- Tarjetas con imagen, nombre, tipo de centro y estado ambiental.
- Temperatura, humedad y CO2 actuales.
- Aforo actual (porcentaje real calculado sobre capacidad máxima, mostrado como variable discreta sin decimales).
- Indicador de ocupación y color de estado.
- Dos gráficas sparkline (temperatura y aforo) en la misma fila, con ejes temporales visibles, escalas independientes y tooltip interactivo (fecha/hora y valor exacto al hacer hover).

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
- GET /api/centers/{center_id}/trend?range=6h

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

- **Hero Card Premium** (Glassmorphism): tres columnas con nombre+badge de estado, atributos físicos (m², capacidad, planta, ocupación con iconos FontAwesome) y mini-dashboard IoT (temperatura, humedad, CO₂, ruido actualizados cada 30s por SocketIO).
- Gráfico Radar separado: condiciones actuales vs rango óptimo según materiales presentes.
- **Sección "Obras y Riesgo"** (solo centros tipo `museum`): tabla con filas alternas, barra de progreso de `degradationRisk` y barra de progreso de `stressAccumulated` (misma paleta de colores dinámica: verde/ámbar/rojo según nivel). Click en la miniatura de la tabla abre un modal de zoom a pantalla completa con la imagen ampliada y la ficha técnica de la obra. La galería de miniaturas sobre la tabla ha sido eliminada para evitar duplicación visual.
- Histórico ambiental multivariable con dropdown de rango (1h/12h/24h), renderizado en grid fijo 2×2 (Temperatura, Humedad, CO₂, Ruido). Eje X con timestamps reales formateados: 1h→HH:MM:SS cada 10 min, 12h→HH:MM cada hora, 24h→HH:MM cada 2 horas. Nunca índices numéricos.
- Línea de tiempo de alertas filtradas por sala.

Datos que muestra en el detalle de obra:

- Ficha técnica de la obra.
- Condiciones actuales frente a condiciones ideales.
- Índice de riesgo de degradación.
- Estrés térmico acumulado.
- Línea de tiempo de alertas relacionadas.

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

- Dashboard analítico único (`auravault-control`) embebido en iframe de viewport completo.
- **Stat Panels**: Dispositivos Activos, CO2 Promedio Global, Pico de Aforo y Lecturas en Alerta en las últimas 24h.
- **Mapa de Calor de Alertas** (Status History): nivel de alerta CO2 por centro (Normal/Moderado/Crítico) por franja horaria en las últimas 24h.
- **Distribución de Incidentes** (Donut / Pie Chart): porcentaje de lecturas que superan umbrales por categoría (CO2 crítico >1000ppm, CO2 elevado 700-1000ppm, Humedad alta >75%, Ruido alto >70dB).
- **Bar Gauges de Flota**: batería media y latencia de red (proxy de RSSI) por dispositivo IoT activo.
- **State Timeline**: disponibilidad (Online/Offline) de dispositivos por centro en las últimas 24h.
- Refresco automático cada 30 segundos sincronizado con el heartbeat del simulador IoT.

Interacciones que permite:

- Filtrar alertas por criterios múltiples.
- Resolver alertas desde la tabla.
- Revisar el detalle de un dispositivo.
- Consultar predicciones de fallo.
- Filtrar por rango temporal dentro del iframe de Grafana.
- Navegar a Grafana en ventana completa mediante enlace directo.

Tecnologías que usa:

- Tablas HTML dinámicas.
- Chart.js para estadísticas de alertas.
- Grafana embebido (iframe 100% viewport height) con provisión automática de dashboard desde JSON.
- Datasource PostgreSQL sobre CrateDB (`auravault-crate`) con queries `$__timeFilter` para filtrado temporal interactivo.
- scikit-learn para predicción de fallo de dispositivos.
- WebSocket para actualización de alertas y estado de sensores.

Endpoints del backend necesarios:

- GET /api/admin/alerts
- GET /api/admin/alerts/stats
- PATCH /api/alerts/{alert_id}/resolve
- GET /api/admin/devices
- GET /api/devices/{device_id}
- GET /api/devices/{device_id}/prediction
- GET /api/grafana/admin — devuelve URL de embed del dashboard `auravault-control` con `refresh=30s`

### 8.7 Vista 7 — Modo Visitante

Objetivo: mostrar al visitante una lectura pública, clara y simplificada del estado ambiental, con acceso a un chatbot inteligente contextual.

**Modo Visitante activo en Vista 3 y Vista 5**: El modo visitante se activa mediante el parámetro `?mode=visitor` en las URLs de detalle de centro (`/center/<id>`) y detalle de sala (`/room/<id>`). Al activarse se muestra contenido enriquecido con historia y patrimonio, y aparece el chatbot flotante AuraBot.

**Vista pública independiente** (`/visitor/<poi_id>`): acceso directo por QR al estado resumido de un centro con recomendación de sala.

Datos que muestra en detalle de centro (modo visitante):

- Historia y patrimonio del centro.
- Calidad del aire con calificación textual y color.
- Horarios, precio de entrada y accesibilidad.
- Galería de salas del centro con acceso directo a cada una.
- AuraBot: chatbot flotante fijo (bottom-right) con contexto del centro.

Datos que muestra en detalle de sala (modo visitante):

- Descripción cultural de la sala y obras expuestas.
- Métricas ambientales actuales (temperatura, CO2, aforo, ruido).
- Lista completa de obras con nombre, artista, año, técnica, material y riesgo de degradación.
- AuraBot: chatbot flotante fijo (bottom-right) con contexto completo de la sala y obras.

Datos que muestra en vista pública independiente:

- Estado simple del aire con calificación textual.
- CO2, temperatura, humedad y aforo actuales.
- Recomendación de la sala con mejores condiciones en ese momento.

Interacciones que permite:

- Activar/desactivar modo visitante desde el botón de la topbar.
- Consultar la vista desde móvil mediante QR.
- Refrescar el contenido automáticamente.
- Abrir AuraBot con el botón circular flotante y preguntar en lenguaje natural.
- Limpiar o continuar el historial de conversación con AuraBot (sessionStorage).
- Navegar entre salas del centro en modo visitante.

Tecnologías que usa:

- HTML responsive adaptado a móvil y escritorio.
- CSS glassmorphism con botón flotante (FAB) fijo mediante `position: fixed`.
- JavaScript con sessionStorage para historial de conversación.
- Flask como proxy de la API de Gemini (la key nunca llega al frontend).
- Gemini API (`gemini-2.5-flash`) para respuestas en lenguaje natural.
- Contexto construido por el frontend (`window.AURABOT_CONTEXT`) a partir de datos ya cargados en la página.

Endpoints del backend necesarios:

- GET /visitor/{poi_id}
- GET /api/public/poi/{poi_id}/summary
- GET /api/public/poi/{poi_id}/recommended-room
- GET /api/public/poi/{poi_id}/rooms
- POST /api/chat — chatbot AuraBot con contexto de sala o centro

## 9. Requisitos funcionales transversales

- El sistema debe mostrar datos actuales, históricos y derivados de las entidades del dominio.
- El sistema debe distinguir claramente entre centro, sala, obra, sensor, alerta y actuador.
- El sistema debe actualizar la información relevante sin recargar la página cuando sea posible.
- El sistema debe permitir navegar desde una vista agregada hasta el nivel de sala y obra.
- El sistema debe calcular y exponer un riesgo de degradación para cada obra.
- El sistema debe generar recomendaciones de sala para visitantes a partir del estado ambiental actual.
- El sistema debe permitir consultas conversacionales del visitante sobre sala y obras usando AuraBot, con contexto en tiempo real inyectado desde el frontend.
- El sistema debe permitir exportar el pasaporte ambiental de una sala.
- El sistema debe permitir comparar varias obras en paralelo.
- El sistema debe permitir activar actuadores cuando se superen umbrales críticos.

## 10. Requisitos no funcionales

- Latencia en tiempo real por WebSocket inferior a 2 segundos entre actualización de datos y visualización.
- Interfaz responsive para móvil, tablet y escritorio.
- Soporte bilingüe español e inglés en toda la interfaz pública y privada.
- Modo visual Dark y Light con persistencia de preferencia de usuario.
- La interfaz visitante debe ser legible en pantallas pequeñas sin necesidad de zoom.
- La respuesta del chatbot AuraBot (Gemini API) debe entregarse en menos de 6 segundos en condiciones normales de red.
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

- Gemini API (`gemini-2.5-flash`) vía HTTPS desde el backend Flask.
- API key almacenada en `backend/gemini.key` (excluido de git), leída por el backend. La key nunca se expone al frontend.
- Contexto construido dinámicamente desde el frontend (`window.AURABOT_CONTEXT`) con los datos ya cargados en la página: sala, centro, métricas ambientales y lista de obras.
- Historial de conversación en `sessionStorage` del navegador (clave `aurabot_history`, máx. 40 mensajes).
- Prompt de sistema controlado por el backend según el tipo de página (sala o centro).

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

## 14. Implementación — Sesión 2 (2026-05-06)

### 14.1 Modo claro rediseñado (verde claro)

- La paleta `:root` se ha cambiado de fondo oscuro (`#162422`) a fondo verde claro (`#c4ddd8`) con texto oscuro (`#182e2b`) para garantizar legibilidad en modo light.
- Se introduce un sistema completo de variables CSS glass: `--glass-bg`, `--glass-sm`, `--glass-border`, `--glass-topbar`, `--glass-btn`, `--glass-btn-h`, `--glass-input`, `--glass-chart`, `--glass-modal`, `--blob-1`, `--blob-2`.
- En modo claro, los fondos glass son semitransparentes blancos (opacidad 0.46–0.74); en modo oscuro se reducen a 0.05–0.10 con negro/oscuro.
- El gradiente de fondo en modo claro usa verdes suaves (`#c4ddd8` → `#aecfc8`) con blobs decorativos teal y ocre.
- Todos los componentes principales (topbar, botones, cards, modales, tabla, inputs, skeleton) ahora usan las variables glass en lugar de valores RGBA hardcodeados.

### 14.2 Panel Grafana eliminado definitivamente

- El bloque HTML del panel Grafana fue eliminado de `center_detail.html`.
- La función `loadGrafana()` fue eliminada de `center_detail.js`.
- No quedan referencias a Grafana en ninguna vista del frontend.

### 14.3 Imágenes de sala (24 salas en Orion)

- Se asignó una imagen representativa y distinta para cada una de las 24 salas de los 4 centros.
- MUNCYT: imágenes del Boeing 747 expuesto en el propio MUNCYT A Coruña (Wikimedia Commons) y salas de museo tipo (Museo del Traje, Auditorio de Valladolid).
- Bellas Artes: salas de galerías de pintura de referencia (Alte Pinakothek, Uffizi, National Gallery) y taller de Sargadelos.
- Teatro Rosalía: imágenes de teatros españoles reales (Teatro Real de Madrid, Gran Teatre del Liceu, Teatro Salón Cervantes).
- Palacio de la Ópera: imágenes del propio Palacio de la Ópera de A Coruña (Wikimedia Commons) y salas de concierto tipo.
- Todas las URLs son directas a `upload.wikimedia.org/wikipedia/commons/thumb/...` (800px), sin redirecciones.

### 14.4 Corrección de imágenes de obras

- 8 artworks tenían URLs rotas (HTTP 400) o altamente rate-limited (Special:FilePath de Wikimedia).
- Disparate Claro → URL directa de Wikimedia para la obra de Goya.
- SEAT 600 D, Microscopio Electrónico, Reproducción del Traje Estratosférico → URLs directas de MUNCYT en Wikimedia.
- La Sagrada Familia → URL directa de Wikimedia (Alonso Cano, Real Academia de Bellas Artes).
- El Muñeco, Figura Femenina con Cántaro, Figura de Gaiteiro → imágenes temáticas alternativas confirmadas (Galicia, Sargadelos).

### 14.5 Símbolos/emojis en tabla de obras

- Se añade una función `materialEmoji(val)` y `techniqueEmoji(val)` en `room_artwork.js`.
- Cada material y técnica tiene un emoji representativo: 🖼️ pintura en lienzo, 🏺 cerámica, 🔬 instrumentación científica, ✈️ ingeniería aeroespacial, 🚗 automoción, 📽️ proyección cinematográfica, etc.
- Los emojis aparecen en la tabla de obras (columna Material/Técnica) y en el modal de zoom.

## Implementación — Issue #17

- Branch: `feature/issue-17-ui-artwork-cleanup`
- Commit: `55970aa` — Hugo — 2026-05-06 18:57:33 +0200
- Descripción: `feat: light mode verde claro, room images, artwork emoji symbols, broken image fixes`

Notas de despliegue y verificación:

- Los cambios UI están en `static/css/style.css` y aplican glassmorphism y modo claro.
- Las imágenes de salas y artworks se actualizaron en Orion; puede ser necesario invalidar caché del CDN para ver cambios inmediatamente.
- Recomendado: crear PR hacia `main` para integrar estos cambios en la rama principal.

## Implementación — Issue #19

- Branch: `feature/issue-19-ui-fixes-images-toggle`
- Merged: `main` — 2026-05-09

### 15.1 Corrección del layout de tarjetas en Vista Detalle de Centro

- `<main class="stagger">` ahora tiene `width:100%` explícito.
- Cada `<article class="card">` dentro de `main.stagger` tiene `width:100%;box-sizing:border-box`.
- Regla CSS añadida: `main.stagger > .card { width:100%; box-sizing:border-box; align-self:stretch; }`.
- Contenedores `#roomsList` y `#actuatorPanel` tienen `box-sizing:border-box`.
- Tarjetas individuales mantienen `flex: 1 1 160px; max-width: 220px`.

### 15.2 Imágenes reales de salas (24 salas)

- **MUNCYT**: Boeing 747 en MUNCYT y Lente de Fresnel de la Torre de Hércules.
- **Bellas Artes**: Sala 6, Caprichos LDUT182, panorámica, obras permanentes.
- **Teatro Rosalía**: Fachada oficial, puerta de entrada, placas del teatro.
- **Palacio Ópera**: Interior del Pazo da Ópera (200 OK), fachadas oficiales 1-3.

### 15.3 Toggle CSS-only para dispositivos

- Implementado con `<label class="device-toggle">` + `<input type="checkbox">` oculto.
- Verde `#2ecc71` (ON), Rojo `#e74c3c` (OFF), Naranja `#e67e22` (ERROR).
- Envía `POST /api/actuators/{id}/command` al cambiar estado.

### 15.4 Corrección de imágenes de obras

- Lente Fresnel: URL 404 corregida a Lente_de_Fresnel_de_la_Torre_de_Hércules.002_-_MUNCYT.jpg.
- Los Caprichos de Goya: sustituida por LDUT182(10) de Wikimedia Commons.
- El Muñeco (Brocos): no existe en Wikimedia; sustituida por Camponesa de Brocos.
- Tetera/Plato/Gaiteiro Sargadelos: sustituidas por imágenes verificadas del museo.
- Disparate Claro: sustituida por LDUT182(11).
- San Sebastián: sustituida por Guadarrama de Ovidio Murguia.
- Figura Femenina (Asorey): sustituida por Na Fragua de Carrero Fernández.

## Implementación — Issue #20

- Branch: `feature/issue-20-alerts-ui-improvements`
- Merged: `main` — 2026-05-11

### 16.1 Tarjeta de alertas en Dashboard

- Cada alerta muestra el **nombre del centro** (`centerName`) en texto secundario entre el tipo y la descripción.
- El campo `centerName` ya estaba disponible en `/api/admin/alerts` (join con Museum por `alertSource → Room → museumId`); no requirió cambio de backend.
- Al pulsar **Resolver**: se envía `PATCH /api/alerts/{id}/resolve` y se aplica la clase CSS `.resolving` al div correspondiente. La animación `alertFadeOut` encoge y desvanece el elemento; al terminar (`animationend`), el nodo se elimina del DOM sin recargar la página.
- WebSocket: si el evento `alerts` recibe `{action: "resolved", alertId: "..."}`, se elimina solo ese item. Para eventos de creación (sin alertId), se recarga la lista completa.

### 16.2 Vista Control — Tab Alertas

**Selectores dinámicos sin estado intermedio:**
- Los selectores de Tipo, Severidad y Estado se pueblan mediante `populateSelect()`, que construye el HTML completo: primera opción `"Todos"` + opciones únicas ordenadas extraídas del dataset actual. El valor seleccionado se restaura tras cada re-render.
- El estado de filtros persiste en `_alertFilterState` para sobrevivir al re-renderizado del `<select>`.
- `wireAlertFilters()` asigna listeners `change` que actualizan `_alertFilterState` y llaman a `loadAlertsTab()`.

**Gráfica reactiva con filtros:**
- `loadAlertsTab()` pasa los filtros activos como query params a **ambos** endpoints: `/api/admin/alerts` (tabla) y `/api/admin/alerts/stats` (gráfica).
- La función `renderAlertsChart(stats)` se extrae de `loadAlertsTab()` y se llama tras cada carga, por lo que la gráfica siempre refleja la misma vista filtrada que la tabla.
- El endpoint `/api/admin/alerts/stats` acepta ahora `center`, `type`, `severity`, `status` y aplica la misma lógica de filtrado que `/api/admin/alerts`.

**Resolución con animación WebSocket:**
- El botón Resolver aplica la clase `.resolving` al `<tr>` y elimina la fila en `animationend`.
- El evento WebSocket `alerts` con `action=resolved` llama a `removeControlAlertRow(alertId)` en lugar de recargar toda la tabla.

### 16.3 CSS — Animaciones de resolución

- `@keyframes alertFadeOut`: colapso vertical (`scaleY`) + desvanecimiento. Para `.alert-item.resolving`.
- `@keyframes rowFadeOut`: opacidad + destello verde. Para `tr.resolving`.
- Ambas clases tienen `pointer-events: none` durante la animación.

## Implementación — CORRECCIÓN 2 (2026-05-12): Chatbot LLM AuraBot

### 17.1 Descripción general

Se implementa un chatbot flotante llamado **AuraBot** disponible exclusivamente en Modo Visitante de las vistas de detalle de centro (Vista 3) y detalle de sala (Vista 5). El chatbot usa la API de Gemini (`gemini-2.5-flash`) desde el backend Flask, recibiendo como contexto todos los datos actualmente mostrados en la página.

### 17.2 Componentes añadidos

| Fichero | Rol |
|---|---|
| `backend/gemini.key` | API key de Gemini (excluido de git mediante `.gitignore`) |
| `backend/static/js/chatbot.js` | Widget autocontenido: FAB, panel, historial, llamadas a `/api/chat` |
| Sección en `backend/static/css/style.css` | Estilos del FAB y panel (`#chatbot-fab`, `#chatbot-panel`, `.chatbot-msg`) |

### 17.3 Endpoint backend

`POST /api/chat`

- **Entrada**: `{ messages: [...], pageUrl: string, context: object | null }`
- **Salida**: `{ reply: string }` o `{ error: string }`
- Lee la API key desde `backend/gemini.key`.
- Construye el system prompt desde el objeto `context` enviado por el frontend.
- Llama a la Gemini API (`gemini-2.5-flash`) con el historial completo de mensajes.
- La API key nunca se expone al frontend.

### 17.4 Contexto de sala (`window.AURABOT_CONTEXT` en `room_artwork.js`)

Tras cargar los datos de la sala, `room_artwork.js` establece `window.AURABOT_CONTEXT` con:
- Nombre de sala y centro, descripción, capacidad, superficie, planta.
- Temperatura, humedad, CO2, ruido, personas, aforo actuales.
- Lista completa de obras: nombre, artista, año, técnica, material, riesgo de degradación (%) y estado de conservación.

### 17.5 Contexto de centro (`window.AURABOT_CONTEXT` en `center_detail.js`)

Tras cargar los datos del centro en modo visitante, `center_detail.js` establece `window.AURABOT_CONTEXT` con:
- Nombre del centro, descripción histórica.
- Temperatura, humedad, CO2 medios, personas, aforo, estado general y alertas activas.
- Lista de salas del centro con nombre y descripción.

### 17.6 Comportamiento del widget

- **FAB**: botón circular teal fijo (`position: fixed; bottom: 28px; right: 28px; z-index: 99999`), siempre visible al hacer scroll.
- **Panel**: 350×500 px con header de color accent, área de mensajes con scroll, input y botón de envío. Botones de cerrar (✕) y limpiar conversación (🗑).
- **Solo en Modo Visitante**: el script verifica `isVisitorMode()` (URL con `?mode=visitor`) en `DOMContentLoaded`. Si no hay modo visitante, no se monta ningún elemento en el DOM.
- **Historial**: guardado en `sessionStorage` (clave `aurabot_history`). Persiste entre navegaciones mientras no se cierre la pestaña o se pulse "Limpiar".
- **Modelo usado**: `gemini-2.5-flash` (verificado como el modelo más capaz disponible con la key del proyecto).

## 19. Internacionalización Completa — CORRECCIÓN 3 (2026-05-13)

### 19.1 Objetivo

Eliminar el 100% del texto hardcodeado en inglés o español de todos los componentes dinámicos de la aplicación, de forma que al cambiar el idioma mediante el toggle de la Navbar toda la vista activa se actualice instantáneamente sin recargar la página.

Criterio de aceptación: ninguna palabra en el idioma no activo debe aparecer en ninguna vista, incluyendo mensajes de error, estados de dispositivos IoT, etiquetas de gráficas, contenido generado por JavaScript y respuestas del chatbot AuraBot.

### 19.2 Sistema de eventos `aura:langchange`

Se introduce el evento DOM personalizado `aura:langchange` (CustomEvent). `setLang()` en `common.js` lo despacha al documento cada vez que el usuario cambia el idioma. Cada módulo JS de página escucha este evento y re-renderiza sus componentes dinámicos sin necesidad de recargar la página.

```javascript
// En common.js — setLang():
document.dispatchEvent(new CustomEvent('aura:langchange', { detail: { lang } }));

// En cada módulo de página:
document.addEventListener('aura:langchange', () => {
  if (document.body.getAttribute('data-page') !== '<page>') return;
  // re-render radar, charts, actuators, visitor content...
});
```

### 19.3 Claves nuevas en `AURA.t` (common.js)

Se añaden ~80 claves nuevas al objeto `AURA.t` (ES y EN) cubriendo:

| Grupo | Claves representativas |
|---|---|
| Calidad del aire | `airExcellentLabel/Text`, `airGoodLabel/Text`, `airAcceptableLabel/Text`, `airImprovableLabel/Text` |
| Modo Visitante | `visitorMode`, `visitorBannerCenter`, `visitorBannerRoom`, `backToManager`, `managerMode` |
| Información de visita | `visitSchedule`, `entryPrice`, `accessibilityLabel`, `checkSchedule`, `checkPrices`, `accessibleCenter` |
| Textos patrimoniales | `historyAndHeritage`, `aboutCenter`, `centerRoomsSection`, `exposedArtworks` |
| Niveles de riesgo | `riskLow`, `riskMedium`, `riskHigh`, `riskCritical` |
| Estado de conservación | `conditionGood`, `conditionWatch`, `conditionRisk`, `conditionCritical`, `conditionUnknown` |
| Atributos de sala | `groundFloor`, `basementLabel`, `roomSurface`, `roomCurrentOccupancy`, `realTimeConditions` |
| Radar | `radarActual`, `radarOptimal`, `radarSubtitle` |
| Modal de zoom | `zoomTitle`, `zoomArtist`, `zoomYear`, `zoomMaterial`, `zoomTechnique`, `zoomRisk`, `zoomStatus`, `zoomOptTemp`, `zoomOptHumidity` |
| Gráficas | `chartTempLabel`, `chartHumLabel`, `chartCo2Label`, `chartNoiseLabel`, `laeqLabel`, `aggregate4Centers` |
| Rangos temporales | `lastHour`, `last1Hour`, `last12hShort`, `last24hShort`, `last24Hours` |
| Chatbot | `aurabotThinking`, `connectionError` |
| 3D | `room3dHint`, `sensorActive`, `sensorInactive`, `sensorFault`, `backToRoomLabel` |
| Vacíos / errores | `noArtworksRoom`, `noAlertsInRoom`, `alertsLoadError`, `alertLabel` |

### 19.4 Archivos JavaScript modificados

| Archivo | Cambios |
|---|---|
| `common.js` | +80 claves i18n ES/EN; `setLang()` añade `document.documentElement.lang` y despacha `aura:langchange`; `applyVisitorMode()` usa `tr('managerMode')` |
| `dashboard.js` | Título del gráfico de tendencia usa `tr('aggregate4Centers')`; escucha `aura:langchange` para re-renderizar el gráfico |
| `center_detail.js` | `airQualityLabel()` usa `tr()`; `bootVisitorCenterDetail()` usa `tr()` para todos los labels; locales de fechas dinámicos (`es-ES`/`en-GB`); escucha `aura:langchange` → recarga histórico, actuadores o vista visitante |
| `room_artwork.js` | `getRiskLabel()`, `getStressLabel()`, `getStatusBadgeHTML()`, `formatFloor()`, locales de ejes y tooltips, radar labels, galería, modal zoom, tabla de obras, heroes, alertas, vista visitante → todos usan `tr()`; escucha `aura:langchange` → recarga radar, charts, tabla |
| `control_center.js` | Opciones de filtros de dispositivos usan `tr('allCenters')`, `tr('filterAllRooms')`, `tr('allTypes')`; escucha `aura:langchange` → recarga pestañas activas |
| `chatbot.js` | Indicador "pensando" usa `tr('aurabotThinking')`; mensaje de error usa `tr('connectionError')`; añade `lang: AURA.lang` al body del POST `/api/chat` |
| `room_3d.js` | Panel de obra: `tr('degradationRisk')`; panel de sensor: `tr('status')`, `tr('battery')`; tooltip: `tr('status')`; barra de info: `tr('room3dHint')` |

### 19.5 Plantillas HTML modificadas

| Plantilla | Cambios |
|---|---|
| `center_detail.html` | `data-i18n` en botón visitante, banner, gauge Ruido, opciones de rango, heading LAeq |
| `room_artwork.html` | `data-i18n` en botón visitante, banner, hero card (título sala, botón 3D, atributos físicos, mini-dashboard, timestamp, subtítulo radar), opciones de rango, headings de gráficas |
| `control_center.html` | `data-i18n` en opciones de filtros de dispositivos (centro, sala, tipo, estado) |
| `twin3d.html` | `data-i18n="noise"` en opción Ruido del selector de variable |
| `room_3d.html` | `data-i18n` en botón Sala, barra de info, leyenda de sensores |

### 19.6 Backend — AuraBot multiidioma

`_build_chatbot_system_prompt(ctx, lang='es')` en `app.py` acepta ahora el parámetro `lang`. El endpoint `POST /api/chat` lee `lang` del body del request y lo pasa al constructor del prompt. Si `lang == 'en'` se genera un system prompt en inglés con instrucción "Always respond in English"; en caso contrario se mantiene el comportamiento original en español. El mensaje de contexto vacío también se traduce según el idioma.

## 18. Consolidación Final (2026-05-13)

### 18.1 Gestión de activos locales (Imagenes)

**Objetivo**: eliminar dependencias externas (Picsum, Unsplash) para Room y Artwork.

**Cambios**:
- `scripts/catalog.py`: campo `image` de todos los `ROOMS` (24 salas) actualizado a rutas `/static/images/rooms/<imagen>.jpeg`.
- `scripts/catalog.py`: campo `image` de 9 `ARTWORKS` con imagen propia actualizado a `/static/images/artworks/<imagen>.jpeg/jpg`. El resto mantiene placeholders Picsum semanticos.
- `backend/static/images/rooms/` y `backend/static/images/artworks/`: 33 imagenes copiadas desde el directorio `images/` raiz del repo para ser servidas por Flask.
- Coherencia sala-imagen garantizada: Sala de Ceramica de Sargadelos → `sala_ceramica_sargadelos_bellasartes.jpeg`, Salon de Grabados de Goya → `salon_grabados_goya_bellasartes.jpeg`, etc.

### 18.2 Optimización final de Grafana (auravault_control)

**Paneles eliminados**: "Pico de Aforo Urbano" y "Distribucion de Incidentes por Categoria y Severidad" (datos inconsistentes/irrelevantes).

**Paneles nuevos**:

| Panel | Tipo | SQL (resumen) |
|---|---|---|
| Promedio de Humedad por Centro | barchart | `SELECT CASE entity_id → centro, AVG(relativehumidity) FROM etindoorenvironmentobserved WHERE $__timeFilter(time_index) GROUP BY centro` |
| Evolución Critica de CO2 (>800 ppm) | timeseries | `SELECT time_index, centro, co2 FROM etindoorenvironmentobserved WHERE $__timeFilter(time_index) AND co2 > 800` |

Todas las consultas SQL usan `time_index` (columna temporal CrateDB). Los paneles no quedan en blanco si el simulador ha publicado datos en el periodo seleccionado.

### 18.3 Sincronizacion E2E e Inteligencia IoT (30s)

- **Simulador**: `update_state()` recibe ahora el parámetro `cycle` para determinar si es un ciclo de alerta forzada.
- **Logica de alertas forzadas**: `_ALERT_ROOM_BY_CENTER` asigna una sala por centro; `_ALERT_CYCLE_PERIOD=10`, `_ALERT_CYCLE_DURATION=3`. Cada ~5 minutos se fuerzan 3 ciclos de alerta (90s de condiciones fuera de rango).
- **SocketIO universal**: `background_update_thread` emite `"update"` (heartbeat) + `"summary"` cada 30s. Todas las vistas (Dashboard, Detalle Centro/Sala, Control) reciben refresco automatico.
- **control_center.js**: añadido `sock.on('update', ...)` para refrescar estadisticas de alertas sin recargar pagina.

### 18.4 Internacionalización Total (ES/EN)

**Claves añadidas al objeto `AURA.t`** en `common.js` (ambos idiomas):

| Clave | ES | EN |
|---|---|---|
| `history` | Historial | History |
| `historicalTrend` | Tendencia histórica | Historical trend |
| `historicalAnalytics` | Análisis histórico | Historical analytics |
| `alertsTimeline` | Línea de tiempo de alertas | Alerts timeline |
| `conditionStatus` | Estado de condiciones | Condition status |
| `degradationRisk` | Riesgo de degradación | Degradation risk |
| `stressAccumulated` | Estrés acumulado | Accumulated stress |
| `resolved` | Resuelto | Resolved |
| `unresolved` | Sin resolver | Unresolved |
| `from` | desde | from |
| `artworks` | Obras | Artworks |
| `stateOn/Off/Fault/Maintenance` | Encendido/Apagado/Fallo/Mantenimiento | On/Off/Fault/Maintenance |
| `alertTypeCO2/Humidity/Temperature/Occupancy/Noise` | CO₂ elevado/Humedad fuera de rango/... | Elevated CO₂/Humidity out of range/... |
| `alertSeverityCritical/High/Medium/Low` | Crítico/Alto/Medio/Bajo | Critical/High/Medium/Low |
| `chatClear/Close/Welcome` | Limpiar/Cerrar/Bienvenida | Clear/Close/Welcome |
| UI extras: `viewIn3D`, `floorLabel`, `capacityLabel`, `hvacStatus`, etc. | ... | ... |

**chatbot.js**: placeholder del input, tooltips de botones y mensaje de bienvenida de AuraBot ahora respetan el idioma activo via `tr()`.

**control_center.js**: función `badgeForState()` usa `tr('stateOn')`, `tr('stateOff')`, etc. para traducir estados de dispositivos.
