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
      resolve: 'Resolver',
      loading: 'Cargando...',
      noData: 'Sin datos',
      visitor: 'Visitante',
      send: 'Enviar',
      room: 'Sala',
      status: 'Estado',
      comfort: 'Confort',
      temperature: 'Temperatura',
      humidity: 'Humedad',
      co2: 'CO2',
      occupancy: 'Aforo',
    },
    en: {
      dashboard: 'Dashboard',
      centers: 'Centers',
      control: 'Control',
      light: 'Light',
      dark: 'Dark',
      alerts: 'Alerts',
      resolve: 'Resolve',
      loading: 'Loading...',
      noData: 'No data',
      visitor: 'Visitor',
      send: 'Send',
      room: 'Room',
      status: 'Status',
      comfort: 'Comfort',
      temperature: 'Temperature',
      humidity: 'Humidity',
      co2: 'CO2',
      occupancy: 'Occupancy',
    },
  },
};

function tr(key) {
  return (AURA.t[AURA.lang] && AURA.t[AURA.lang][key]) || key;
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
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = tr(el.getAttribute('data-i18n'));
  });
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
  return `<span class="badge ${cls}">${cls}</span>`;
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
