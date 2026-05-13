const AURA = {
  lang: localStorage.getItem('aura-lang') || 'es',
  theme: localStorage.getItem('aura-theme') || 'light',
  socket: null,
  t: {
    es: {
      dashboard: 'Dashboard',
      centers: 'Centros',
      control: 'Control',
      light: 'Claro',
      dark: 'Oscuro',
      alerts: 'Alertas',
      devices: 'Dispositivos',
      device: 'Dispositivo',
      grafana: 'Grafana',
      resolve: 'Resolver',
      loading: 'Cargando...',
      noData: 'Sin datos',
      noDataAvailable: 'Sin datos disponibles',
      noAlerts: 'No hay alertas para mostrar',
      noDevices: 'No hay dispositivos para mostrar',
      visitor: 'Visitante',
      send: 'Enviar',
      room: 'Sala',
      status: 'Estado',
      comfort: 'Confort',
      temperature: 'Temperatura',
      humidity: 'Humedad',
      co2: 'CO2',
      occupancy: 'Aforo',
      optimal: 'Óptimo',
      attention: 'Atención',
      critical: 'Crítico',
      searchCenter: 'Buscar centro...',
      placeholderChat: 'Pregunta por la sala, obras o recomendaciones',
      clickRoomPanel: 'Haz click en una sala para ver lecturas en tiempo real y obras.',
      recommendation: 'Recomendación',
      recommendationIndex: 'índice',
      airExcellent: 'Aire excelente',
      airAcceptable: 'Aire aceptable',
      airImproving: 'Aire mejorable',
      totalVisitors: 'Visitantes totales',
      roomsOptimal: 'Salas en rango optimo',
      artworksRisk: 'Obras en riesgo',
      riskWorks: 'Obras en riesgo',
      activeSensors: 'Sensores activos',
      museum: 'Museo',
      theatre: 'Teatro',
      auditorium: 'Auditorio',
      optimalStatus: 'Óptimo',
      attentionStatus: 'Atención',
      criticalStatus: 'Crítico',
      free: 'Libre',
      moderate: 'Moderado',
      congested: 'Congestionado',
      typeLabel: 'Tipo',
      viewDetail: 'Ver detalle',
      allTypes: 'Tipo: todos',
      allStatuses: 'Estado: todos',
      allOccupancy: 'Aforo: todos',
      allCenters: 'Centro: todos',
      allSeverity: 'Severidad: todas',
      allState: 'Estado: todos',
      mapTitle: 'Mapa de centros culturales',
      modelTitle: 'Modelo de datos',
      historyTitle: 'Histórico multivariable',
      chatTitle: 'Chat de visita',
      actual: 'Actual',
      optimalLabel: 'Óptimo',
      lux: 'Lux',
      decibel: 'dB',
      selectUpTo3: 'Selecciona hasta 3 obras.',
      exportPdf: 'Exportar PDF',
      exportMd: 'Exportar Markdown',
      compareSelected: 'Comparar seleccion (max 3)',
      currentConditions: 'Condiciones actuales vs rango optimo',
      worksRisk: 'Obras y riesgo',
      roomDetails: 'Detalle sala',
      variable: 'Variable',
      simulatePropagation: 'Simular propagacion',
      artworks: 'Obras',
      artwork: 'Obra',
      artist: 'Artista',
      material: 'Material',
      showHide: 'Mostrar/Ocultar',
      last6Hours: 'Últimas 6 horas',
      last12Hours: 'Últimas 12 horas',
      fromTo: 'desde',
      to: 'hasta',
      temperatureWithUnit: 'Temperatura (°C)',
      occupancyWithUnit: 'Ocupación (personas)',
      criticalTemp: 'Umbral crítico temperatura',
      criticalOccupancy: 'Umbral crítico aforo',
      type: 'Tipo',
      severity: 'Severidad',
      state: 'Estado',
      source: 'Fuente',
      date: 'Fecha',
      center: 'Centro',
      lastReading: 'Última lectura',
      battery: 'Batería',
      room: 'Sala',
      imageAlt: 'Imagen del centro',
      directLink: 'Abrir enlace directo',
      history: 'Historial',
      historicalTrend: 'Tendencia histórica',
      historicalAnalytics: 'Análisis histórico',
      alertsTimeline: 'Línea de tiempo de alertas',
      conditionStatus: 'Estado de condiciones',
      degradationRisk: 'Riesgo de degradación',
      stressAccumulated: 'Estrés acumulado',
      resolved: 'Resuelto',
      unresolved: 'Sin resolver',
      from: 'desde',
      artworks: 'Obras',
      stateOn: 'Encendido',
      stateOff: 'Apagado',
      stateFault: 'Fallo',
      stateMaintenance: 'Mantenimiento',
      alertTypeCO2: 'CO₂ elevado',
      alertTypeHumidity: 'Humedad fuera de rango',
      alertTypeTemperature: 'Temperatura fuera de rango',
      alertTypeOccupancy: 'Aforo superado',
      alertTypeNoise: 'Ruido elevado',
      alertSeverityCritical: 'Crítico',
      alertSeverityHigh: 'Alto',
      alertSeverityMedium: 'Medio',
      alertSeverityLow: 'Bajo',
      chatClear: 'Limpiar conversación',
      chatClose: 'Cerrar',
      chatWelcome: 'Hola, soy AuraBot. Pregúntame sobre las obras expuestas, el ambiente de la sala o la historia del centro.',
      noRoomSelected: 'Selecciona una sala para ver información.',
      viewIn3D: 'Ver en 3D',
      floorLabel: 'Planta',
      areaLabel: 'Área',
      capacityLabel: 'Aforo máximo',
      sensorReadings: 'Lecturas de sensores',
      hvacStatus: 'Estado HVAC',
      activateHvac: 'Activar HVAC',
      deactivateHvac: 'Desactivar HVAC',
      commandSent: 'Comando enviado',
      errorSendingCommand: 'Error al enviar comando',
      // Actuator context states
      actuatorActive: 'Activo',
      actuatorInactive: 'Inactivo',
      actuatorError: 'Error',
      // Air quality
      airExcellentLabel: 'Excelente',
      airGoodLabel: 'Buena',
      airAcceptableLabel: 'Aceptable',
      airImprovableLabel: 'Mejorable',
      airExcellentText: 'La calidad del aire es excelente. Perfecta para la visita.',
      airGoodText: 'La calidad del aire es buena. Condiciones óptimas.',
      airAcceptableText: 'La calidad del aire es aceptable.',
      airImprovableText: 'La calidad del aire es mejorable en este momento.',
      // Visitor mode
      visitorMode: 'Modo Visitante',
      visitorBannerCenter: 'Vista turística del centro cultural',
      visitorBannerRoom: 'Vista turística de la sala',
      backToManager: 'Volver al modo gestor',
      managerMode: 'Modo Gestor',
      visitSchedule: 'Horarios de visita',
      entryPrice: 'Precio de entrada',
      accessibilityLabel: 'Accesibilidad',
      checkSchedule: 'Consulte horarios en recepción',
      checkPrices: 'Consulte precios en taquilla',
      accessibleCenter: 'Centro accesible',
      historyAndHeritage: 'Historia y patrimonio',
      aboutCenter: 'Sobre el centro',
      centerRoomsSection: 'Salas del centro',
      exposedArtworks: 'Obras expuestas en esta sala',
      // Risk and stress levels
      riskLow: 'Bajo',
      riskMedium: 'Medio',
      riskHigh: 'Alto',
      riskCritical: 'Crítico',
      // Condition status
      conditionGood: 'Óptimo',
      conditionWatch: 'Atención',
      conditionRisk: 'Riesgo',
      conditionCritical: 'Crítico',
      conditionUnknown: 'Desconocido',
      // Room attributes
      groundFloor: 'Planta Baja',
      basementLabel: 'Sótano',
      roomSurface: 'Superficie',
      roomCurrentOccupancy: 'Ocupación actual',
      realTimeConditions: 'Condiciones en tiempo real',
      updating: 'Actualizando...',
      updatedAt: 'Actualizado:',
      loadingRoom: 'Cargando sala...',
      viewRoomIn3D: 'Ver sala en 3D',
      // Radar chart
      radarActual: 'Actual',
      radarOptimal: 'Óptimo',
      radarSubtitle: 'Comparativa ambiental en tiempo real',
      // Artwork zoom modal
      zoomTitle: 'Título',
      zoomArtist: 'Artista',
      zoomYear: 'Año',
      zoomMaterial: 'Material',
      zoomTechnique: 'Técnica',
      zoomRisk: 'Riesgo',
      zoomStatus: 'Estado',
      zoomOptTemp: 'T° óptima',
      zoomOptHumidity: 'HR óptima',
      artworkUnknown: 'Desconocido',
      clickToZoom: 'Clic para ampliar',
      // Alert / empty states
      noArtworksRoom: 'No hay obras en esta sala',
      noAlertsInRoom: 'Sin alertas activas en esta sala',
      alertsLoadError: 'No se pudieron cargar las alertas',
      alertLabel: 'Alerta',
      artworkSingular: 'obra',
      // Metrics and chart labels
      noise: 'Ruido',
      illuminance: 'Iluminancia',
      laeqLabel: 'LAeq (Ruido)',
      chartTempLabel: 'Temperatura (°C)',
      chartHumLabel: 'Humedad (%)',
      chartCo2Label: 'CO₂ (ppm)',
      chartNoiseLabel: 'Ruido (dB)',
      aggregate4Centers: 'Evolución agregada de los 4 centros',
      // Time range options
      lastHour: 'Última hora',
      last1Hour: 'Última 1 hora',
      last12hShort: 'Últimas 12h',
      last24hShort: 'Últimas 24h',
      last24Hours: 'Últimas 24 horas',
      // Chatbot
      aurabotThinking: 'AuraBot está pensando…',
      connectionError: 'Error de conexión. Inténtalo de nuevo.',
      // Device filter
      filterAllRooms: 'Sala: todas',
      personsUnit: 'personas',
      // Room 3D
      room3dHint: 'Clic en obra o sensor para más info',
      sensorActive: 'Sensor activo',
      sensorInactive: 'Sensor inactivo',
      sensorFault: 'Sensor en fallo',
      backToRoomLabel: 'Sala',
    },
    en: {
      dashboard: 'Dashboard',
      centers: 'Centers',
      control: 'Control',
      light: 'Light',
      dark: 'Dark',
      alerts: 'Alerts',
      devices: 'Devices',
      device: 'Device',
      grafana: 'Grafana',
      resolve: 'Resolve',
      loading: 'Loading...',
      noData: 'No data',
      noDataAvailable: 'No data available',
      noAlerts: 'No alerts to show',
      noDevices: 'No devices to show',
      visitor: 'Visitor',
      send: 'Send',
      room: 'Room',
      status: 'Status',
      comfort: 'Comfort',
      temperature: 'Temperature',
      humidity: 'Humidity',
      co2: 'CO2',
      occupancy: 'Occupancy',
      optimal: 'Optimal',
      attention: 'Attention',
      critical: 'Critical',
      searchCenter: 'Search center...',
      placeholderChat: 'Ask about the room, artworks or recommendations',
      clickRoomPanel: 'Click a room to see real-time readings and artworks.',
      recommendation: 'Recommendation',
      recommendationIndex: 'index',
      airExcellent: 'Excellent air',
      airAcceptable: 'Acceptable air',
      airImproving: 'Air could improve',
      totalVisitors: 'Total visitors',
      roomsOptimal: 'Rooms in optimal range',
      artworksRisk: 'Artworks at risk',
      riskWorks: 'Artworks at risk',
      activeSensors: 'Active sensors',
      museum: 'Museum',
      theatre: 'Theatre',
      auditorium: 'Auditorium',
      optimalStatus: 'Optimal',
      attentionStatus: 'Attention',
      criticalStatus: 'Critical',
      free: 'Free',
      moderate: 'Moderate',
      congested: 'Congested',
      typeLabel: 'Type',
      viewDetail: 'View detail',
      allTypes: 'Type: all',
      allStatuses: 'Status: all',
      allOccupancy: 'Occupancy: all',
      allCenters: 'Center: all',
      allSeverity: 'Severity: all',
      allState: 'State: all',
      mapTitle: 'Cultural centers map',
      modelTitle: 'Data model',
      historyTitle: 'Multivariable history',
      chatTitle: 'Visitor chat',
      actual: 'Actual',
      optimalLabel: 'Optimal',
      lux: 'Lux',
      decibel: 'dB',
      selectUpTo3: 'Select up to 3 artworks.',
      exportPdf: 'Export PDF',
      exportMd: 'Export Markdown',
      compareSelected: 'Compare selected (max 3)',
      currentConditions: 'Current conditions vs optimal range',
      worksRisk: 'Artworks and risk',
      roomDetails: 'Room detail',
      variable: 'Variable',
      simulatePropagation: 'Simulate spread',
      artworks: 'Artworks',
      artwork: 'Artwork',
      artist: 'Artist',
      material: 'Material',
      showHide: 'Show/Hide',
      last6Hours: 'Last 6 hours',
      last12Hours: 'Last 12 hours',
      fromTo: 'from',
      to: 'to',
      temperatureWithUnit: 'Temperature (°C)',
      occupancyWithUnit: 'Occupancy (people)',
      criticalTemp: 'Critical temperature threshold',
      criticalOccupancy: 'Critical occupancy threshold',
      type: 'Type',
      severity: 'Severity',
      state: 'State',
      source: 'Source',
      date: 'Date',
      center: 'Center',
      lastReading: 'Last reading',
      battery: 'Battery',
      room: 'Room',
      imageAlt: 'Center image',
      directLink: 'Open direct link',
      history: 'History',
      historicalTrend: 'Historical trend',
      historicalAnalytics: 'Historical analytics',
      alertsTimeline: 'Alerts timeline',
      conditionStatus: 'Condition status',
      degradationRisk: 'Degradation risk',
      stressAccumulated: 'Accumulated stress',
      resolved: 'Resolved',
      unresolved: 'Unresolved',
      from: 'from',
      artworks: 'Artworks',
      stateOn: 'On',
      stateOff: 'Off',
      stateFault: 'Fault',
      stateMaintenance: 'Maintenance',
      alertTypeCO2: 'Elevated CO₂',
      alertTypeHumidity: 'Humidity out of range',
      alertTypeTemperature: 'Temperature out of range',
      alertTypeOccupancy: 'Occupancy exceeded',
      alertTypeNoise: 'Elevated noise',
      alertSeverityCritical: 'Critical',
      alertSeverityHigh: 'High',
      alertSeverityMedium: 'Medium',
      alertSeverityLow: 'Low',
      chatClear: 'Clear conversation',
      chatClose: 'Close',
      chatWelcome: 'Hi, I am AuraBot. Ask me about the artworks on display, the room environment or the center\'s history.',
      noRoomSelected: 'Select a room to view information.',
      viewIn3D: 'View in 3D',
      floorLabel: 'Floor',
      areaLabel: 'Area',
      capacityLabel: 'Max capacity',
      sensorReadings: 'Sensor readings',
      hvacStatus: 'HVAC status',
      activateHvac: 'Activate HVAC',
      deactivateHvac: 'Deactivate HVAC',
      commandSent: 'Command sent',
      errorSendingCommand: 'Error sending command',
      // Actuator context states
      actuatorActive: 'Active',
      actuatorInactive: 'Inactive',
      actuatorError: 'Error',
      // Air quality
      airExcellentLabel: 'Excellent',
      airGoodLabel: 'Good',
      airAcceptableLabel: 'Acceptable',
      airImprovableLabel: 'Could improve',
      airExcellentText: 'The air quality is excellent. Perfect for your visit.',
      airGoodText: 'The air quality is good. Optimal conditions.',
      airAcceptableText: 'The air quality is acceptable.',
      airImprovableText: 'The air quality could improve at this time.',
      // Visitor mode
      visitorMode: 'Visitor Mode',
      visitorBannerCenter: 'Tourist view of the cultural center',
      visitorBannerRoom: 'Tourist view of the room',
      backToManager: 'Back to manager mode',
      managerMode: 'Manager Mode',
      visitSchedule: 'Visit schedule',
      entryPrice: 'Entry price',
      accessibilityLabel: 'Accessibility',
      checkSchedule: 'Please check opening hours at reception',
      checkPrices: 'Please check prices at the ticket office',
      accessibleCenter: 'Accessible center',
      historyAndHeritage: 'History and heritage',
      aboutCenter: 'About the center',
      centerRoomsSection: 'Center rooms',
      exposedArtworks: 'Artworks on display in this room',
      // Risk and stress levels
      riskLow: 'Low',
      riskMedium: 'Medium',
      riskHigh: 'High',
      riskCritical: 'Critical',
      // Condition status
      conditionGood: 'Optimal',
      conditionWatch: 'Watch',
      conditionRisk: 'Risk',
      conditionCritical: 'Critical',
      conditionUnknown: 'Unknown',
      // Room attributes
      groundFloor: 'Ground Floor',
      basementLabel: 'Basement',
      roomSurface: 'Surface area',
      roomCurrentOccupancy: 'Current occupancy',
      realTimeConditions: 'Real-time conditions',
      updating: 'Updating...',
      updatedAt: 'Updated:',
      loadingRoom: 'Loading room...',
      viewRoomIn3D: 'View room in 3D',
      // Radar chart
      radarActual: 'Current',
      radarOptimal: 'Optimal',
      radarSubtitle: 'Real-time environmental comparison',
      // Artwork zoom modal
      zoomTitle: 'Title',
      zoomArtist: 'Artist',
      zoomYear: 'Year',
      zoomMaterial: 'Material',
      zoomTechnique: 'Technique',
      zoomRisk: 'Risk',
      zoomStatus: 'Status',
      zoomOptTemp: 'Optimal T°',
      zoomOptHumidity: 'Optimal HR',
      artworkUnknown: 'Unknown',
      clickToZoom: 'Click to zoom',
      // Alert / empty states
      noArtworksRoom: 'No artworks in this room',
      noAlertsInRoom: 'No active alerts in this room',
      alertsLoadError: 'Could not load alerts',
      alertLabel: 'Alert',
      artworkSingular: 'artwork',
      // Metrics and chart labels
      noise: 'Noise',
      illuminance: 'Illuminance',
      laeqLabel: 'LAeq (Noise)',
      chartTempLabel: 'Temperature (°C)',
      chartHumLabel: 'Humidity (%)',
      chartCo2Label: 'CO₂ (ppm)',
      chartNoiseLabel: 'Noise (dB)',
      aggregate4Centers: 'Aggregate trend of 4 centers',
      // Time range options
      lastHour: 'Last hour',
      last1Hour: 'Last 1 hour',
      last12hShort: 'Last 12h',
      last24hShort: 'Last 24h',
      last24Hours: 'Last 24 hours',
      // Chatbot
      aurabotThinking: 'AuraBot is thinking…',
      connectionError: 'Connection error. Please try again.',
      // Device filter
      filterAllRooms: 'Room: all',
      personsUnit: 'people',
      // Room 3D
      room3dHint: 'Click on artwork or sensor for more info',
      sensorActive: 'Active sensor',
      sensorInactive: 'Inactive sensor',
      sensorFault: 'Sensor fault',
      backToRoomLabel: 'Room',
    },
  },
};

function tr(key) {
  return (AURA.t[AURA.lang] && AURA.t[AURA.lang][key]) || key;
}

function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = tr(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', tr(el.getAttribute('data-i18n-placeholder')));
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', tr(el.getAttribute('data-i18n-title')));
  });
  root.querySelectorAll('[data-i18n-alt]').forEach((el) => {
    el.setAttribute('alt', tr(el.getAttribute('data-i18n-alt')));
  });
}

function setTheme(theme) {
  AURA.theme = theme;
  localStorage.setItem('aura-theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? tr('light') : tr('dark');
  }
}

function setLang(lang) {
  AURA.lang = lang;
  localStorage.setItem('aura-lang', lang);
  document.documentElement.lang = lang;
  applyTranslations();
  const btn = document.getElementById('langToggle');
  if (btn) {
    btn.textContent = lang.toUpperCase();
  }
  setTheme(AURA.theme);
  document.dispatchEvent(new CustomEvent('aura:langchange', { detail: { lang } }));
}

async function apiGet(path) {
  const response = await fetch(path);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

async function apiSend(path, method, body) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

function statusBadge(status) {
  const cls = status || 'attention';
  return `<span class="badge ${cls}">${tr(cls)}</span>`;
}

function ensureSocket() {
  if (AURA.socket) return AURA.socket;
  AURA.socket = io();
  return AURA.socket;
}

function formatNumber(val, digits = 1) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '-';
  return Number(val).toFixed(digits);
}

function formatMetric(val, options = {}) {
  const {
    digits = 1,
    unit = '',
    zeroAsMissing = true,
    fallback = '—',
  } = options;
  if (val === null || val === undefined || val === '' || Number.isNaN(Number(val))) return fallback;
  const numeric = Number(val);
  if (zeroAsMissing && numeric === 0) return fallback;
  return `${numeric.toFixed(digits)}${unit ? ` ${unit}` : ''}`;
}

function formatTimestampLabel(timestamp, range = '1h') {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp);
  
  let options = { hour: '2-digit', minute: '2-digit' };
  if (range === '24h' || range === '7d') {
    options = { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  }
  
  return new Intl.DateTimeFormat(AURA.lang === 'en' ? 'en-GB' : 'es-ES', options).format(date);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function activeNav() {
  const page = document.body.getAttribute('data-page');
  document.querySelectorAll('.nav-link').forEach((el) => {
    if (el.dataset.page === page) el.classList.add('active');
  });
}

function wireToolbar() {
  const themeBtn = document.getElementById('themeToggle');
  const langBtn = document.getElementById('langToggle');

  if (themeBtn) {
    themeBtn.addEventListener('click', () => setTheme(AURA.theme === 'dark' ? 'light' : 'dark'));
  }
  if (langBtn) {
    langBtn.addEventListener('click', () => setLang(AURA.lang === 'es' ? 'en' : 'es'));
  }
}

function isVisitorMode() {
  return new URLSearchParams(window.location.search).get('mode') === 'visitor';
}

function toggleVisitorMode() {
  const url = new URL(window.location.href);
  if (isVisitorMode()) {
    url.searchParams.delete('mode');
  } else {
    url.searchParams.set('mode', 'visitor');
  }
  window.location.href = url.toString();
}

function applyVisitorMode() {
  if (!isVisitorMode()) return;
  document.documentElement.setAttribute('data-visitor', 'true');
  const banner = document.getElementById('visitorBanner');
  if (banner) banner.style.display = '';
  const toggleBtn = document.getElementById('visitorModeToggle');
  if (toggleBtn) toggleBtn.innerHTML = `<i class="fas fa-arrow-left"></i> ${tr('managerMode')}`;
}

function initCommon() {
  setTheme(AURA.theme);
  setLang(AURA.lang);
  wireToolbar();
  activeNav();
  applyVisitorMode();
}

document.addEventListener('DOMContentLoaded', initCommon);
