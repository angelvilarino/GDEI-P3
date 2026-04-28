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
  applyTranslations();
  const btn = document.getElementById('langToggle');
  if (btn) {
    btn.textContent = lang.toUpperCase();
  }
  setTheme(AURA.theme);
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

function formatTimestampLabel(timestamp) {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp);
  return new Intl.DateTimeFormat(AURA.lang === 'en' ? 'en-GB' : 'es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

function initCommon() {
  setTheme(AURA.theme);
  setLang(AURA.lang);
  wireToolbar();
  activeNav();
}

document.addEventListener('DOMContentLoaded', initCommon);
