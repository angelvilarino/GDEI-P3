## 1. Objetivo

AuraVault es una aplicacion FIWARE orientada a la monitorizacion ambiental de centros culturales de interior y a la conservacion preventiva de obras. Su objetivo es convertir lecturas IoT en decisiones operativas para tres perfiles: Gestor, Conservador y Visitante.

La plataforma integra datos en tiempo real, historicos y analitica aplicada para:

- vigilar confort ambiental y ocupacion por centro y por sala,
- detectar desviaciones con impacto en conservacion,
- priorizar riesgos sobre obras sensibles,
- apoyar respuestas operativas con actuadores,
- ofrecer una vista publica clara y util para visitante.

El sistema se fundamenta en NGSI-LD para mantener trazabilidad semantica entre Museum, Room, Artwork, Device, observaciones, Alert y Actuator, con interoperabilidad extremo a extremo.

## 2. Estado del arte del dominio de aplicacion

En museos, teatros y salas de exposicion, el control ambiental ha pasado de soluciones cerradas de tipo BMS a arquitecturas IoT con mayor interoperabilidad. Aun asi, muchas plataformas comerciales siguen centradas en telemetria y alarmas simples, con limitaciones en tres frentes:

- baja estandarizacion semantica entre sensores, salas y activos culturales,
- debil conexion entre la medida ambiental y la obra afectada,
- dificultad para combinar operacion diaria, historico y comunicacion publica en una misma experiencia.

AuraVault aborda estas brechas con una arquitectura FIWARE y modelo NGSI-LD unificado. Orion CB mantiene el estado contextual actual, QuantumLeap y CrateDB gestionan historicos temporales, e IoT Agent sobre MQTT integra dispositivos. Sobre esa base, Flask orquesta APIs, eventos y logica de negocio para vistas operativas y de visitante.

El resultado es una solucion de dominio cultural interior que integra monitorizacion, conservacion, control y divulgacion en una misma cadena de valor digital, manteniendo consistencia semantica y capacidad de evolucion.

## 3. Funcionalidades principales

- Monitorizacion ambiental en tiempo real de centros, salas, obras y dispositivos.
- Vista global de estado, alertas, ocupacion y tendencia operativa.
- Exploracion geoespacial y comparativa entre centros culturales.
- Analisis historico por rangos temporales para diagnostico tecnico.
- Gemelo digital 3D para inspeccion visual avanzada por sala.
- Seguimiento de riesgo de degradacion de obras.
- Gestion de alertas y resolucion operativa desde panel de control.
- Control de actuadores bajo reglas de seguridad y contexto.
- Modo visitante con lectura simplificada y recomendacion de sala.
- Chatbot contextual con LLM local usando contexto NGSI-LD.

## 4. Funcionalidades detalladas (resumen del PRD.md)

Vista 1 - Dashboard Global: consolida KPIs de confort, ocupacion, riesgo y estado de sensores; permite resolver alertas y navegar al detalle por centro.

Vista 2 - Explorador de Centros: presenta tarjetas comparables por estado ambiental, aforo y tendencia corta; incorpora filtros por tipo, estado y ocupacion.

Vista 3 - Detalle del Centro: combina gauges en vivo, historico multivariable, listado de salas y obras en riesgo, estado de actuadores y panel Grafana embebido.

Vista 4 - Gemelo Digital 3D: representa salas y variables ambientales con interaccion (zoom, rotacion, seleccion de sala) y actualizacion continua por eventos.

Vista 5 - Detalle de Sala y Obra: analiza condiciones actuales frente a rangos de conservacion, historico por obra, comparativa entre piezas y pasaporte ambiental exportable.

Vista 6 - Centro de Control: unifica administracion de alertas y dispositivos, con estadisticas operativas, diagnostico de flota y apoyo a prediccion de fallo.

Vista 7 - Modo Visitante: ofrece una lectura publica, simple y movil de calidad ambiental, ocupacion y recomendacion de sala, con consulta en lenguaje natural.

Capacidades transversales: tiempo real por WebSocket, consulta historica, trazabilidad semantica entre entidades, exportacion de informacion tecnica y soporte bilingue para experiencia publica.

## 5. Diagrama de la arquitectura

![Diagrama de la arquitectura](docs/architecture.png)

## 6. Diagrama del modelo de datos

![Diagrama del modelo de datos](docs/data_model.png)
