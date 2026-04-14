# Domain analysis AuraVault

## 1. Estado del arte

La monitorizacion ambiental en museos y teatros ha evolucionado desde sistemas BMS cerrados hacia plataformas IoT con analitica contextual. En el mercado, soluciones como Conserv, DicksonOne (Dickson), Hanwell, TSI y sistemas de gestion HVAC de fabricantes como Siemens (Desigo), Schneider (EcoStruxure) o Johnson Controls integran sensores de temperatura, humedad y en menor medida CO2/particulas para vigilar condiciones de conservacion y confort. En museos, el foco historico ha sido la conservacion preventiva (microclima estable en vitrinas, salas y almacenes); en teatros y auditorios se prioriza ademas confort termico-acustico de publico y personal, con restricciones operativas por ocupacion variable y eventos en horario nocturno.

Estas soluciones comerciales suelen resolver bien tres capas: adquisicion de datos, alarmistica basica por umbrales y reporting. Sin embargo, presentan limitaciones habituales para un despliegue multiproveedor: modelos de datos propietarios, dificultad para interoperar con otras fuentes (aforos, ticketing, mantenimiento), y escasa trazabilidad semantica entre "condicion ambiental", "activo cultural" y "accion correctiva". En muchos casos, la inteligencia se centra en series temporales de sensores, sin modelar explicitamente el impacto sobre obras concretas o salas con usos distintos (exposicion permanente, foyer, caja escenica, talleres, etc.).

En investigacion europea, varios proyectos H2020/Horizon han impulsado marcos utiles para AuraVault: STORM (resiliencia y respuesta ante riesgos en patrimonio cultural), HERACLES (riesgo climatico y herramientas de proteccion para patrimonio), APACHE (plataforma holistica para preservacion de patrimonio tangible) y ARCH (resiliencia de areas historicas). Aunque no todos se enfocan exclusivamente en interiores, comparten enfoques transferibles: evaluacion multicriterio de riesgo, integracion de fuentes heterogeneas, y uso de modelos digitales para apoyo a decision. Tambien el ecosistema IPERION HS ha reforzado metodologias e instrumentacion cientifica para caracterizacion y conservacion.

A nivel normativo, la conservacion preventiva se apoya en referencias como EN 15757 (gestion de temperatura y humedad para limitar dano mecanico higroscopico), EN 16893 (requisitos de localizacion y construccion de depositos), ISO 11799 (almacenamiento de documentos), guias ASHRAE para museos/archivos/bibliotecas (clases de control ambiental segun sensibilidad y factibilidad energetica), e indicaciones del ICOM-CC sobre estrategias de riesgo, no solo sobre consignas fijas. La tendencia actual pasa de "setpoints rigidos" a "bandas de aceptabilidad por coleccion/material", con monitorizacion continua y respuesta proporcional.

Para el contexto de A Coruna (MUNCYT, Museo de Bellas Artes, Teatro Rosalia y Palacio de la Opera), el reto diferencial es la coexistencia de espacios con perfiles ambientales muy distintos: salas expositivas con obra sensible, areas de gran afluencia, escenarios con cargas termicas puntuales de iluminacion y ocupacion, y variaciones por cercania maritima (humedad exterior alta). AuraVault aporta valor al combinar FIWARE + Smart Data Models para interoperabilidad real, trazabilidad NGSI-LD extremo a extremo (sensor -> sala -> obra -> alerta -> actuacion), y un modelo de riesgo de degradacion por obra/material que supera la simple alarmistica por umbral. Esa diferenciacion permite operar con criterios de conservacion preventiva y eficiencia energetica de forma simultanea.

## 2. Smart Data Models estandar

Notas generales:
- Tipo NGSI-LD en todos los casos: `Property`, `Relationship` o `GeoProperty`.
- Campos comunes frecuentes heredados de comunes SDM: `id`, `type`, `name`, `description`, `alternateName`, `address`, `areaServed`, `dataProvider`, `dateCreated`, `dateModified`, `owner`, `source`, `seeAlso`, `location`.
- Clasificacion:
  - Estatico: cambia rara vez (metadatos, catalogo, inventario, definicion de dispositivo/modelo).
  - Dinamico: actualizacion continua por agentes IoT (MQTT/ETL).

### 2.1 IndoorEnvironmentObserved

Descripcion: observacion de condiciones ambientales interiores.

Atributos NGSI-LD (completos):
- `id` (Property, obligatorio): identificador unico.
- `type` (Property, obligatorio): `IndoorEnvironmentObserved`.
- `location` (GeoProperty, obligatorio): geometria del punto/zona observada.
- `dateObserved` (Property, obligatorio): fecha/hora ISO8601 de observacion.
- `refDevice` (Relationship, opcional): dispositivo(s) fuente.
- `refPointOfInterest` (Relationship, opcional): POI asociado (p.ej., museo/sala).
- `sensorPlacement` (Property, opcional): posicion del sensor (`northWall`, `southWall`, `eastWall`, `westWall`, `center`, `floor`, `roof`, `ceiling`).
- `sensorHeight` (Property, opcional): altura del sensor.
- `peopleCount` (Property, opcional): numero de personas.
- `temperature` (Property, opcional): temperatura.
- `relativeHumidity` (Property, opcional): humedad relativa.
- `atmosphericPressure` (Property, opcional): presion atmosferica.
- `illuminance` (Property, opcional): iluminancia.
- `co2` (Property, opcional): concentracion interior de CO2.
- Comunes opcionales: `name`, `description`, `alternateName`, `address`, `areaServed`, `dataProvider`, `dateCreated`, `dateModified`, `owner`, `source`, `seeAlso`.

Estatico vs dinamico:
- Estatico: `id`, `type`, `location` (si sensor fijo), `refDevice`, `refPointOfInterest`, `sensorPlacement`, `sensorHeight`, metadatos comunes.
- Dinamico: `dateObserved`, `temperature`, `relativeHumidity`, `co2`, `illuminance`, `atmosphericPressure`, `peopleCount`.

Unidades y rangos tipicos interiores (AuraVault):
- `temperature`: degC, tipico 18-24 degC (conservacion fina 20-22 degC).
- `relativeHumidity`: %, tipico 40-60% (papel/textil sensibles: 45-55%).
- `co2`: ppm operativo 400-1200 ppm (accion recomendada >1000 ppm).
- `illuminance`: lux, 50-200 lux para obra sensible; 200-500 lux en transito.
- `atmosphericPressure`: hPa, tipico 980-1035 hPa.
- `peopleCount`: personas, 0-capacidad de sala.
- `sensorHeight`: m, tipico 1.5-3.5 m.

### 2.2 NoiseLevelObserved

Descripcion: observacion de niveles acusticos.

Atributos NGSI-LD (completos):
- Obligatorios: `id`, `type` (`NoiseLevelObserved`), `location`, `dateObservedFrom`, `dateObservedTo`.
- Opcionales:
  - `dateObserved` (intervalo ISO8601).
  - `refDevice` (Relationship).
  - `refPointOfInterest` (Relationship).
  - `refWeatherObserved` (Relationship).
  - `LAS`, `LAeq`, `LAeq_d`, `LAmax` (Property numericas de nivel sonoro).
  - `sonometerClass` (Property enum: `0`, `1`, `2`).
  - `obstacles`, `heightAverage`, `distanceAverage`.
  - Comunes: `name`, `description`, `alternateName`, `address`, `areaServed`, `dataProvider`, `dateCreated`, `dateModified`, `owner`, `source`, `seeAlso`.

Estatico vs dinamico:
- Estatico: `id`, `type`, `location`, `refDevice`, `refPointOfInterest`, `sonometerClass`, `obstacles`, `heightAverage`, `distanceAverage`.
- Dinamico: `dateObserved*`, `LAS`, `LAeq`, `LAeq_d`, `LAmax`.

Unidades y rangos tipicos:
- `LAS`, `LAeq`, `LAeq_d`, `LAmax`: dB(A).
- Rangos orientativos interiores culturales:
  - Salas de museo: 35-55 dB(A) (picos puntuales 60-70).
  - Vestibulos/colas: 50-70 dB(A).
  - Teatro en funcion: 70-95 dB(A) segun programa.
- `heightAverage`, `distanceAverage`: m (si se informa como distancia efectiva).

### 2.3 CrowdFlowObserved

Descripcion: observacion de flujo de personas en un tramo/espacio.

Atributos NGSI-LD (completos):
- Obligatorios: `id`, `type` (`CrowdFlowObserved`), `dateObserved`.
- Opcionales:
  - `dateObservedFrom`, `dateObservedTo`.
  - `location`.
  - `refRoadSegment` (Relationship, reutilizable para corredor/tramo interior modelado).
  - `peopleCount`, `peopleCountTowards`, `peopleCountAway`.
  - `occupancy` (fraccion 0-1).
  - `averageCrowdSpeed`.
  - `averageHeadwayTime`.
  - `congested` (boolean).
  - `direction` (`inbound`/`outbound`).
  - Comunes: `name`, `description`, `alternateName`, `address`, `areaServed`, `dataProvider`, `dateCreated`, `dateModified`, `owner`, `source`, `seeAlso`.

Estatico vs dinamico:
- Estatico: `id`, `type`, `location` (si punto fijo), `refRoadSegment`, `direction` (si configurado fijo).
- Dinamico: `dateObserved*`, `peopleCount*`, `occupancy`, `averageCrowdSpeed`, `averageHeadwayTime`, `congested`.

Unidades y rangos tipicos:
- `peopleCount*`: personas por ventana de observacion.
- `occupancy`: 0-1 (ratio temporal/espacial).
- `averageCrowdSpeed`: km/h (tipico interior 1-4 km/h).
- `averageHeadwayTime`: s (tipico 0.5-5 s; <1 s suele indicar alta densidad).

### 2.4 Museum

Descripcion: entidad geografica/semantica de museo.

Atributos NGSI-LD (completos):
- Obligatorios: `id`, `type` (`Museum`), `location`, `name`.
- Opcionales:
  - `museumType` (array tipologia de museo).
  - `facilities` (array servicios).
  - `historicalPeriod`, `artPeriod`, `buildingType`, `featuredArtist`.
  - `contactPoint`, `touristArea`, `openingHoursSpecification`, `refSeeAlso`.
  - Comunes: `description`, `alternateName`, `address`, `areaServed`, `dataProvider`, `dateCreated`, `dateModified`, `owner`, `source`, `seeAlso`.

Estatico vs dinamico:
- Estatico: practicamente todos (catalogo y metadatos del activo).
- Dinamico: en operacion normal ninguno continuo; cambios eventuales en horarios, servicios o metadatos.

Unidades/rangos:
- No hay magnitudes continuas obligatorias. Es entidad de referencia topologica/organizativa.

### 2.5 Device y DeviceModel

#### Device

Atributos NGSI-LD (completos segun modelo):
- Obligatorios: `id`, `type` (`Device`), `controlledProperty`.
- Opcionales principales:
  - Identidad/red: `serialNumber`, `ipAddress`, `macAddress`, `mcc`, `mnc`.
  - Clasificacion: `category`, `deviceCategory`.
  - Operacion/estado: `deviceState`, `value`, `batteryLevel`, `rssi`, `direction`.
  - Ciclo de vida: `dateInstalled`, `dateFirstUsed`, `dateManufactured`, `dateLastCalibration`, `dateLastValueReported`, `dateObserved`.
  - Versionado: `hardwareVersion`, `softwareVersion`, `firmwareVersion`, `osVersion`.
  - Relacionales: `refDeviceModel` (Relationship), `controlledAsset`.
  - Configuracion: `configuration`, `supportedProtocol`.
  - Posicion relativa: `distance`, `depth`, `relativePosition`, `location`.
  - Comunes: `name`, `description`, `alternateName`, `address`, `areaServed`, `dataProvider`, `dateCreated`, `dateModified`, `owner`, `provider`, `source`, `seeAlso`, `dstAware`.

Estatico vs dinamico:
- Estatico: identificacion, versiones, `refDeviceModel`, categoria, protocolos, instalacion/fabricacion.
- Dinamico: `batteryLevel`, `rssi`, `deviceState`, `value`, `dateLastValueReported`, `dateObserved`, posicion si movil.

Unidades/rangos:
- `batteryLevel`: 0-1 (o -1 indeterminado).
- `rssi`: dBm tipico -100 a -30 dBm.
- `distance`, `depth`: unidades CEFACT (tipico m).

#### DeviceModel

Atributos NGSI-LD (completos):
- Obligatorios: `id`, `type` (`DeviceModel`), `category`, `controlledProperty`, `manufacturerName`, `brandName`, `modelName`.
- Opcionales:
  - `deviceCategory`, `deviceClass` (C0/C1/C2), `energyLimitationClass` (E0/E1/E2/E9).
  - `function` (sensing, metering, onOff, etc.).
  - `supportedProtocol`, `supportedUnits`.
  - `documentation`, `image`, `color`, `macAddress`.
  - Comunes: `name`, `description`, `alternateName`, `annotations`, `dataProvider`, `dateCreated`, `dateModified`, `owner`, `source`, `seeAlso`.

Estatico vs dinamico:
- Estatico: todos (catalogo tecnico de modelo).
- Dinamico: ninguno en tiempo real.

Unidades/rangos:
- No aplica salvo `supportedUnits` (catalogo de unidades CEFACT/UCUM segun dispositivo).

### 2.6 Alert

Descripcion: alerta generada por usuario/dispositivo para notificacion/accion.

Atributos NGSI-LD (completos):
- Obligatorios: `id`, `type` (`Alert`), `alertSource`, `category`, `dateIssued`.
- Opcionales:
  - `subCategory` (taxonomia extensa: trafico, clima, seguridad, salud, ambiente, etc.).
  - `severity` (`informational`, `low`, `medium`, `high`, `critical`).
  - `validFrom`, `validTo`.
  - `location`, `description`, `data` (payload).
  - Comunes: `name`, `alternateName`, `address`, `areaServed`, `dataProvider`, `dateCreated`, `dateModified`, `owner`, `source`, `seeAlso`.

Estatico vs dinamico:
- Estatico: minima identidad/tipo.
- Dinamico: categoria/subcategoria/severidad/validez/descripcion/payload por evento.

Unidades/rangos:
- No magnitud fisica principal; usar severidad discreta y ventanas temporales ISO8601.

## 3. Entidades custom NGSI-LD

### 3.1 Room

Definicion propuesta:
- `id` (Property, obligatorio)
- `type` (Property, obligatorio, valor `Room`)
- `name` (Property, obligatorio, string)
- `floor` (Property, obligatorio, string/int)
- `area` (Property, obligatorio, number, unidad `m2`)
- `capacity` (Property, obligatorio, integer, personas)
- `roomType` (Property, obligatorio, enum: `exhibition`, `performance`, `lobby`)
- `isLocatedIn` (Relationship, obligatorio -> `Museum`)
- `location` (GeoProperty, opcional recomendado para planos)

Clasificacion:
- Estatico: todos salvo cambios de aforo/configuracion.

### 3.2 Artwork

Definicion propuesta:
- `id` (Property, obligatorio)
- `type` (Property, obligatorio, valor `Artwork`)
- `name` (Property, obligatorio)
- `artist` (Property, obligatorio)
- `year` (Property, opcional, integer)
- `material` (Property, obligatorio, array/string)
- `technique` (Property, opcional)
- `origin` (Property, opcional)
- `conservationRequirements` (Property, obligatorio, object):
  - `temperatureMin`, `temperatureMax` (degC)
  - `humidityMin`, `humidityMax` (%)
  - `co2Max` (ppm)
  - `illuminanceMax` (lux)
  - `noiseMax` (dB(A))
- `isExposedIn` (Relationship, obligatorio -> `Room`)
- `degradationRisk` (Property, obligatorio, Float 0-1, dinamico)

Clasificacion:
- Estatico: metadatos de catalogo + `conservationRequirements` + `isExposedIn` (salvo movimiento de obra).
- Dinamico: `degradationRisk`.

### 3.3 Actuator

Definicion propuesta:
- `id` (Property, obligatorio)
- `type` (Property, obligatorio, valor `Actuator`)
- `name` (Property, obligatorio)
- `actuatorType` (Property, obligatorio, enum sugerido: `dehumidifier`, `hvac`, `ventilation`, `purifier`, `damper`)
- `status` (Property, obligatorio, enum: `on`, `off`, `error`)
- `commandSent` (Property, opcional, string/object con ultimo comando)
- `isLocatedIn` (Relationship, obligatorio -> `Room`)
- `isControlledBy` (Relationship, obligatorio -> `Device`)

Clasificacion:
- Estatico: `id`, `type`, `name`, `actuatorType`, relaciones topologicas.
- Dinamico: `status`, `commandSent`.

## 4. Grafo de Relationships NGSI-LD

Relaciones estandar + custom (origen -> propiedad -> destino):
- `IndoorEnvironmentObserved` -> `refDevice` -> `Device`
- `IndoorEnvironmentObserved` -> `refPointOfInterest` -> `Museum` (o `Room` si se extiende POI interno)
- `NoiseLevelObserved` -> `refDevice` -> `Device`
- `NoiseLevelObserved` -> `refPointOfInterest` -> `Museum`/`Room`
- `NoiseLevelObserved` -> `refWeatherObserved` -> `WeatherObserved` (si se integra exterior)
- `CrowdFlowObserved` -> `refRoadSegment` -> `RoadSegment` (adaptable a corredor interno modelado)
- `Device` -> `refDeviceModel` -> `DeviceModel`
- `Alert` -> `alertSource` -> `Device`/`System` (fuente emisora)
- `Room` -> `isLocatedIn` -> `Museum`
- `Artwork` -> `isExposedIn` -> `Room`
- `Actuator` -> `isLocatedIn` -> `Room`
- `Actuator` -> `isControlledBy` -> `Device`

Grafo funcional recomendado AuraVault:
- `Museum` contiene `Room`.
- `Room` alberga `Artwork`, `Device` (sensores), y `Actuator`.
- `IndoorEnvironmentObserved`, `NoiseLevelObserved`, `CrowdFlowObserved` referencian `Device` y/o `Room/Museum`.
- Motor de reglas calcula `Artwork.degradationRisk`.
- Si riesgo/condicion supera politica -> se crea `Alert` y se emite `commandSent` a `Actuator` via `Device`.

## 5. Rangos ambientales de referencia por tipo de espacio

Referencias operativas para los 4 centros de A Coruna (MUNCYT, Museo de Bellas Artes, Teatro Rosalia, Palacio de la Opera).

### Salas de exposicion (coleccion sensible)
- Temperatura: 20-22 degC (aceptable 18-24).
- Humedad relativa: 45-55% (aceptable 40-60, minimizar oscilaciones rapidas).
- CO2: ideal <800 ppm; accion >1000 ppm.
- Iluminancia: 50-200 lux (papel/textil/fotografia: 50 lux; pintura/escultura: hasta 150-200 lux).
- Ruido continuo: 35-55 dB(A).

### Almacenes y reservas tecnicas
- Temperatura: 16-20 degC.
- Humedad relativa: 40-55% segun material.
- CO2: <1000 ppm.
- Iluminancia: <150 lux en uso; minimo en reposo.
- Ruido: <50 dB(A) recomendado.

### Vestibulos y zonas de alto transito
- Temperatura: 19-24 degC.
- Humedad relativa: 40-60%.
- CO2: 600-1200 ppm segun ocupacion puntual.
- Iluminancia: 200-500 lux.
- Ruido: 50-70 dB(A).

### Salas de teatro/auditorio durante funcion
- Temperatura: 20-24 degC (confort publico).
- Humedad relativa: 40-60%.
- CO2: objetivo <1200 ppm.
- Iluminancia en platea: variable por escena; en accesos 100-300 lux.
- Ruido ambiental no artistico: minimizar; niveles sonoros escenicos pueden superar 85 dB(A) segun programa.

### Escenario, caja escenica y backstage
- Temperatura: 18-24 degC.
- Humedad relativa: 40-60% (control especial para instrumentos y escenografia sensible).
- CO2: <1000-1200 ppm.
- Iluminancia tecnica: 300-1000 lux en montaje/ensayo.
- Ruido operacional: 55-85 dB(A), gestionar exposicion ocupacional.

Observacion de aplicacion local:
- En A Coruna, la humedad exterior elevada puede forzar deshumidificacion prolongada; conviene priorizar estrategias de control por deriva (pendiente de cambio) y no solo por umbral fijo, para evitar ciclos de sobrecorreccion.
