/* ═══════════════════════════════════════════
   Vista 5 — Detalle de Sala (room_artwork.js)
   ═══════════════════════════════════════════ */
let radarChart;
let tempChart, humidityChart, co2Chart, noiseChart;
let currentRange = '24h';
let currentCenter = null;
let currentArtworks = [];
let currentEnvData = null;

function roomIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[1]);
}

function avgReq(artworks) {
  if (!artworks.length) return { temperature: 21, humidity: 50, co2: 800, illuminance: 120, noise: 55 };
  const sum = artworks.reduce((acc, a) => {
    const r = a.conservationRequirements || {};
    acc.temperature += (Number(r.temperatureMin || 18) + Number(r.temperatureMax || 22)) / 2;
    acc.humidity += (Number(r.humidityMin || 45) + Number(r.humidityMax || 55)) / 2;
    acc.co2 += Number(r.co2Max || 900);
    acc.illuminance += Number(r.illuminanceMax || 150);
    acc.noise += Number(r.noiseMax || 60);
    return acc;
  }, { temperature: 0, humidity: 0, co2: 0, illuminance: 0, noise: 0 });
  const n = artworks.length;
  return {
    temperature: sum.temperature / n,
    humidity: sum.humidity / n,
    co2: sum.co2 / n,
    illuminance: sum.illuminance / n,
    noise: sum.noise / n,
  };
}

function getRiskLevel(risk) {
  if (risk < 0.25) return 'low';
  if (risk < 0.5) return 'medium';
  if (risk < 0.75) return 'high';
  return 'critical';
}

function getRiskLabel(risk) {
  if (risk < 0.25) return 'Bajo';
  if (risk < 0.5) return 'Medio';
  if (risk < 0.75) return 'Alto';
  return 'Crítico';
}

function getStressLevel(stress) {
  // stress is 0-1 normalised (or 0-100 index, clamped to 0-1)
  const s = stress > 1 ? stress / 100 : stress;
  if (s < 0.25) return 'low';
  if (s < 0.5) return 'medium';
  if (s < 0.75) return 'high';
  return 'critical';
}

function getStressLabel(stress) {
  const s = stress > 1 ? stress / 100 : stress;
  if (s < 0.25) return 'Bajo';
  if (s < 0.5) return 'Medio';
  if (s < 0.75) return 'Alto';
  return 'Crítico';
}

function getStressNorm(stress) {
  // Returns 0-1 value regardless of raw scale
  return stress > 1 ? Math.min(stress / 100, 1) : Math.min(stress, 1);
}

function getConditionClass(status) {
  const m = { good: 'ok', watch: 'warn', risk: 'warn', critical: 'danger' };
  return m[status] || 'ok';
}

function getStatusBadgeHTML(status) {
  const labels = { optimal: 'Óptimo', attention: 'Atención', critical: 'Crítico', ok: 'Óptimo', warn: 'Atención', danger: 'Crítico' };
  const cls = { optimal: 'ok', ok: 'ok', attention: 'warn', warn: 'warn', critical: 'danger', danger: 'danger' };
  const icons = { optimal: 'fa-circle-check', ok: 'fa-circle-check', attention: 'fa-triangle-exclamation', warn: 'fa-triangle-exclamation', critical: 'fa-circle-xmark', danger: 'fa-circle-xmark' };
  const c = cls[status] || 'ok';
  const i = icons[status] || 'fa-circle-check';
  return `<span class="status-badge ${c}"><i class="fas ${i}"></i> ${labels[status] || 'Desconocido'}</span>`;
}

function formatFloor(floor) {
  if (floor === 0) return 'Planta Baja';
  if (floor < 0) return `Sótano ${Math.abs(floor)}`;
  return `Planta ${floor}`;
}

/* ── Tooltip config corregido (sin retardo) ── */
function makeTooltipConfig(unit) {
  return {
    enabled: true,
    animation: false,
    intersect: false,
    mode: 'nearest',
    backgroundColor: 'rgba(10,25,30,0.92)',
    padding: 12,
    cornerRadius: 10,
    titleFont: { size: 12, weight: '600' },
    bodyFont: { size: 13, weight: '700' },
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    callbacks: {
      title(ctx) {
        const ts = ctx[0]?.label;
        if (!ts) return '';
        try {
          return new Date(ts).toLocaleString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          });
        } catch { return ts; }
      },
      label(ctx) {
        const v = ctx.parsed.y;
        return ` ${ctx.dataset.label}: ${v !== null && v !== undefined ? Number(v).toFixed(2) : 'N/A'} ${unit}`;
      }
    }
  };
}

/* ── Gráfico Radar ── */
function renderRadar(current, optimal) {
  const labels = ['Temperatura', 'Humedad', 'CO₂ /10', 'Iluminancia', 'Ruido'];
  const cVals = [
    Number(current.temperature || 0),
    Number(current.relativeHumidity || 0),
    Number(current.co2 || 0) / 10,
    Number(current.illuminance || 0),
    Number(current.LAeq || 0),
  ];
  const oVals = [optimal.temperature, optimal.humidity, optimal.co2 / 10, optimal.illuminance, optimal.noise];

  if (radarChart) radarChart.destroy();
  radarChart = new Chart(document.getElementById('roomRadar'), {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual',
          data: cVals,
          borderColor: '#0e7c74',
          backgroundColor: 'rgba(14,124,116,0.18)',
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#0e7c74',
        },
        {
          label: 'Óptimo',
          data: oVals,
          borderColor: '#d27d3f',
          backgroundColor: 'rgba(210,125,63,0.12)',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#d27d3f',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { r: { beginAtZero: true, ticks: { font: { size: 11 } } } },
      plugins: {
        tooltip: {
          enabled: true,
          animation: false,
          callbacks: {
            label(ctx) { return `${ctx.dataset.label}: ${ctx.parsed.r.toFixed(2)}`; }
          }
        },
        legend: { position: 'bottom' }
      },
    },
  });
}

/* ── Galería interactiva ── */
function renderGallery(artworks) {
  const gallery = document.getElementById('artworksGallery');
  if (!artworks.length) {
    gallery.innerHTML = '<div class="gallery-empty"><i class="fas fa-image-slash"></i><span>No hay obras en esta sala</span></div>';
    return;
  }
  gallery.innerHTML = artworks.map(a => `
    <div class="gallery-item" data-art-id="${a.id}" tabindex="0" role="button" aria-label="Ver detalle de ${a.name}">
      <img src="${a.image || 'https://placehold.co/80x80/1d2627/0e7c74?text=Arte'}"
           alt="${a.name}"
           loading="lazy"
           onerror="this.src='https://placehold.co/80x80/1d2627/0e7c74?text=Arte'"/>
      <div class="gallery-item-overlay">
        <span class="gallery-item-name">${a.name.substring(0, 22)}${a.name.length > 22 ? '…' : ''}</span>
        <span class="gallery-item-artist">${a.artist || ''}</span>
      </div>
      <div class="gallery-risk-dot risk-dot-${getRiskLevel(Number(a.degradationRisk || 0))}"></div>
    </div>
  `).join('');

  document.querySelectorAll('.gallery-item').forEach(item => {
    const open = () => openZoom(item.dataset.artId, artworks);
    item.addEventListener('click', open);
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
  });
}

function openZoom(artId, artworks) {
  const artwork = artworks.find(a => a.id === artId);
  if (!artwork) return;
  const overlay = document.getElementById('artworkZoomOverlay');
  document.getElementById('zoomImage').src = artwork.image || '';
  document.getElementById('zoomImage').alt = artwork.name;
  const req = artwork.conservationRequirements || {};
  document.getElementById('zoomInfo').innerHTML = `
    <div class="zoom-info-item"><span class="zoom-info-label">Título</span><span class="zoom-info-value">${artwork.name}</span></div>
    <div class="zoom-info-item"><span class="zoom-info-label">Artista</span><span class="zoom-info-value">${artwork.artist || 'Desconocido'}</span></div>
    <div class="zoom-info-item"><span class="zoom-info-label">Año</span><span class="zoom-info-value">${artwork.year || '—'}</span></div>
    <div class="zoom-info-item"><span class="zoom-info-label">Material</span><span class="zoom-info-value">${artwork.material || '—'}</span></div>
    <div class="zoom-info-item"><span class="zoom-info-label">Técnica</span><span class="zoom-info-value">${artwork.technique || '—'}</span></div>
    <div class="zoom-info-item"><span class="zoom-info-label">Riesgo</span>
      <span class="zoom-info-value risk-pill-${getRiskLevel(Number(artwork.degradationRisk || 0))}">
        ${getRiskLabel(Number(artwork.degradationRisk || 0))} (${Number(artwork.degradationRisk || 0).toFixed(3)})
      </span>
    </div>
    <div class="zoom-info-item"><span class="zoom-info-label">Estado</span><span class="zoom-info-value">${artwork.conditionStatus || 'good'}</span></div>
    ${req.temperatureMin ? `<div class="zoom-info-item"><span class="zoom-info-label">T° óptima</span><span class="zoom-info-value">${req.temperatureMin}–${req.temperatureMax} °C</span></div>` : ''}
    ${req.humidityMin ? `<div class="zoom-info-item"><span class="zoom-info-label">HR óptima</span><span class="zoom-info-value">${req.humidityMin}–${req.humidityMax} %</span></div>` : ''}
  `;
  overlay.style.display = 'flex';
}

/* ── Tabla de obras ── */
function renderArtworkTable(artworks) {
  currentArtworks = artworks;
  const badge = document.getElementById('artworksCountBadge');
  if (badge) badge.textContent = `${artworks.length} obra${artworks.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('artworksTableBody');
  tbody.innerHTML = artworks.map((a, i) => {
    const risk = Number(a.degradationRisk || 0);
    const riskLevel = getRiskLevel(risk);
    const condClass = getConditionClass(a.conditionStatus);
    const stressRaw = Number(a.stressAccumulated || 0);
    const stressNorm = getStressNorm(stressRaw);
    const stressLevel = getStressLevel(stressRaw);
    const stressLabel = getStressLabel(stressRaw);
    return `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td>
          <img src="${a.image || 'https://placehold.co/60x45/1d2627/0e7c74?text=Arte'}"
               alt="${a.name}"
               class="artwork-thumb artwork-thumb-clickable"
               data-art-id="${a.id}"
               onerror="this.src='https://placehold.co/60x45/1d2627/0e7c74?text=Arte'"
               loading="lazy"
               title="Clic para ampliar"/>
        </td>
        <td class="artwork-name-cell">
          <strong>${a.name}</strong>
          ${a.year ? `<span class="artwork-year">${a.year}</span>` : ''}
        </td>
        <td class="artwork-artist-cell">${a.artist || '—'}</td>
        <td class="artwork-material-cell">
          <span class="material-tag">${a.material || '—'}</span>
          ${a.technique ? `<span class="technique-tag">${a.technique}</span>` : ''}
        </td>
        <td>
          <div class="risk-bar">
            <div class="risk-progress">
              <div class="risk-progress-fill ${riskLevel}" style="width:${Math.min(risk * 100, 100).toFixed(1)}%" title="${getRiskLabel(risk)}"></div>
            </div>
            <span class="risk-value risk-${riskLevel}">${risk.toFixed(3)}</span>
          </div>
        </td>
        <td>
          <div class="risk-bar">
            <div class="risk-progress">
              <div class="stress-progress-fill ${stressLevel}" style="width:${Math.min(stressNorm * 100, 100).toFixed(1)}%" title="${stressLabel}"></div>
            </div>
            <span class="risk-value risk-${stressLevel}">${stressNorm.toFixed(3)}</span>
          </div>
        </td>
        <td><span class="condition-badge ${condClass}">${a.conditionStatus || 'good'}</span></td>
      </tr>
    `;
  }).join('');

  // Wire click-to-zoom on thumbnails in table
  tbody.querySelectorAll('.artwork-thumb-clickable').forEach(img => {
    img.addEventListener('click', () => openZoom(img.dataset.artId, artworks));
  });
}

/* ── Gráficas históricas ── */
function renderIndividualCharts(history) {
  const labels = history.temperature?.map(p => p.timestamp) || [];

  function makeChart(canvasId, label, dataKey, color, unit) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label,
          data: (history[dataKey] || []).map(p => p.value),
          borderColor: color,
          backgroundColor: color + '18',
          pointRadius: 0,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: color,
          tension: 0.22,
          borderWidth: 2.5,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7, font: { size: 10 } }, grid: { display: false } },
          y: { beginAtZero: false, grid: { color: 'rgba(128,128,128,0.08)' } }
        },
        plugins: {
          legend: { display: false },
          tooltip: makeTooltipConfig(unit)
        }
      },
    });
  }

  if (tempChart) tempChart.destroy();
  if (humidityChart) humidityChart.destroy();
  if (co2Chart) co2Chart.destroy();
  if (noiseChart) noiseChart.destroy();

  tempChart = makeChart('tempChart', 'Temperatura (°C)', 'temperature', '#0e7c74', '°C');
  humidityChart = makeChart('humidityChart', 'Humedad (%)', 'relativeHumidity', '#3d9ecf', '%');
  co2Chart = makeChart('co2Chart', 'CO₂ (ppm)', 'co2', '#d27d3f', 'ppm');
  noiseChart = makeChart('noiseChart', 'Ruido (dB)', 'LAeq', '#a86b18', 'dB');
}

/* ── Actualizar Hero Card (llamado en sync IoT) ── */
function updateHeroMetrics(envData) {
  if (!envData) return;
  const env = envData.environment || {};
  const noise = envData.noise || {};
  const crowd = envData.crowd || {};

  const setVal = (id, val, suffix) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val != null ? `${Number(val).toFixed(1)}${suffix}` : `--${suffix}`;
  };

  setVal('roomTemp', env.temperature, '°C');
  setVal('roomHumidity', env.relativeHumidity, '%');
  setVal('roomCO2', env.co2, ' ppm');
  setVal('roomNoise', noise.LAeq, ' dB');

  const occEl = document.getElementById('roomOccupancy');
  if (occEl) occEl.textContent = env.peopleCount != null ? `${Math.round(env.peopleCount)} personas` : '-- personas';

  // Colorear métricas según umbrales
  colorMetric('metricTemp', env.temperature, 18, 25);
  colorMetric('metricHumidity', env.relativeHumidity, 40, 60);
  colorMetricHigh('metricCO2', env.co2, 1000, 1300);
  colorMetricHigh('metricNoise', noise.LAeq, 70, 82);

  const updateEl = document.getElementById('heroLastUpdate');
  if (updateEl) updateEl.textContent = `Actualizado: ${new Date().toLocaleTimeString('es-ES')}`;

  currentEnvData = envData;
}

function colorMetric(id, val, warnLow, warnHigh) {
  const el = document.getElementById(id);
  if (!el || val == null) return;
  el.className = el.className.replace(/ (metric-ok|metric-warn|metric-danger)/g, '');
  if (val < warnLow || val > warnHigh) el.classList.add('metric-warn');
  else el.classList.add('metric-ok');
}

function colorMetricHigh(id, val, warnThresh, critThresh) {
  const el = document.getElementById(id);
  if (!el || val == null) return;
  el.className = el.className.replace(/ (metric-ok|metric-warn|metric-danger)/g, '');
  if (val > critThresh) el.classList.add('metric-danger');
  else if (val > warnThresh) el.classList.add('metric-warn');
  else el.classList.add('metric-ok');
}

/* ── Carga principal ── */
async function loadRoomView() {
  const roomId = roomIdFromPath();
  let room, envCurrent, artworks, history;

  try {
    room = await apiGet(`/api/rooms/${encodeURIComponent(roomId)}`);
  } catch { return; }
  if (!room) return;

  // Detectar centroId desde museumId de la sala
  const centerId = room.museumId || '';

  [envCurrent, artworks, history] = await Promise.all([
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/environment/current`).catch(() => null),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/artworks`).catch(() => []),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/history?range=${currentRange}`).catch(() => ({})),
  ]);

  // Centro (para lógica museo/teatro)
  const centerCode = centerId.split(':').pop()?.split('-')[0] || '';
  let center = null;
  try {
    center = await apiGet(`/api/centers/${encodeURIComponent(centerId)}`);
  } catch { /* no bloqueante */ }

  currentCenter = center;

  // ── Hero Card
  const roomNameEl = document.getElementById('roomName');
  if (roomNameEl) roomNameEl.textContent = room.name || 'Sala';

  const breadcrumbCenter = document.getElementById('breadcrumbCenter');
  if (breadcrumbCenter && center) breadcrumbCenter.textContent = center.name || centerId;

  const statusBadgeEl = document.getElementById('roomStatusBadge');
  if (statusBadgeEl) statusBadgeEl.outerHTML = getStatusBadgeHTML(room.status || 'optimal');

  const typeBadgeEl = document.getElementById('roomTypeBadge');
  if (typeBadgeEl) typeBadgeEl.textContent = room.roomType || '';

  const descEl = document.getElementById('roomDescription');
  if (descEl) descEl.textContent = room.description || '';

  document.getElementById('roomArea').textContent = room.area ? `${room.area} m²` : '-- m²';
  document.getElementById('roomCapacity').textContent = room.capacity ? `${room.capacity} personas` : '-- personas';
  document.getElementById('roomFloor').textContent = room.floor != null ? formatFloor(room.floor) : '--';

  updateHeroMetrics(envCurrent);

  // ── Radar: condiciones actuales vs óptimas
  renderRadar(
    { ...envCurrent?.environment, ...envCurrent?.noise },
    avgReq(artworks || [])
  );

  // ── Lógica condicional: obras SOLO en museos
  const artworksSection = document.getElementById('artworksSection');
  const museumType = (center?.museumType || []);
  const isMuseum = museumType.includes('museum') || museumType.includes('science-museum') || museumType.includes('fine-arts-museum');

  if (isMuseum && artworks?.length > 0) {
    artworksSection.style.display = 'block';
    renderGallery(artworks);
    renderArtworkTable(artworks);
  } else {
    artworksSection.style.display = 'none';
  }

  // ── Gráficas históricas
  renderIndividualCharts(history || {});

  // ── Alertas (timeline)
  loadAlerts(roomId);
}

async function loadAlerts(roomId) {
  const timeline = document.getElementById('alertsTimeline');
  if (!timeline) return;
  try {
    const alerts = await apiGet(`/api/admin/alerts`);
    const roomAlerts = (alerts || []).filter(a =>
      a.alertSource === roomId || (a.alertSource && a.alertSource.includes(roomId.split(':').pop()))
    ).slice(0, 10);

    if (!roomAlerts.length) {
      timeline.innerHTML = '<div class="timeline-empty"><i class="fas fa-check-circle"></i> Sin alertas activas en esta sala</div>';
      return;
    }

    const sevClass = { critical: 'danger', high: 'warn', medium: 'warn', low: 'ok', informational: 'ok' };
    timeline.innerHTML = roomAlerts.map(a => `
      <div class="timeline-item alert-item ${sevClass[a.severity] || 'ok'}">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <strong>${a.subCategory || a.category || 'Alerta'}</strong>
            <span class="timeline-severity ${sevClass[a.severity] || 'ok'}">${a.severity || ''}</span>
          </div>
          <p class="timeline-desc">${a.description || ''}</p>
          <span class="timeline-time">${a.dateIssued ? new Date(a.dateIssued).toLocaleString('es-ES') : ''}</span>
        </div>
      </div>
    `).join('');
  } catch {
    timeline.innerHTML = '<div class="timeline-empty">No se pudieron cargar las alertas</div>';
  }
}

async function changeRange(range) {
  currentRange = range;
  const roomId = roomIdFromPath();
  try {
    const history = await apiGet(`/api/rooms/${encodeURIComponent(roomId)}/history?range=${range}`);
    renderIndividualCharts(history || {});
  } catch { /* silent */ }
}


function wireActions() {
  document.getElementById('historicalRange')?.addEventListener('change', e => changeRange(e.target.value));

  const zoomOverlay = document.getElementById('artworkZoomOverlay');
  document.querySelector('.zoom-close')?.addEventListener('click', () => { if (zoomOverlay) zoomOverlay.style.display = 'none'; });
  zoomOverlay?.addEventListener('click', e => { if (e.target === zoomOverlay) zoomOverlay.style.display = 'none'; });
  // Close zoom on Escape
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && zoomOverlay?.style.display === 'flex') zoomOverlay.style.display = 'none'; });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'room-artwork') return;
  wireActions();
  loadRoomView().catch(err => console.error('[room_artwork]', err));

  // Sync IoT cada 30s via SocketIO
  const sock = ensureSocket();
  sock.on('update', async () => {
    const roomId = roomIdFromPath();
    try {
      const envCurrent = await apiGet(`/api/rooms/${encodeURIComponent(roomId)}/environment/current`);
      updateHeroMetrics(envCurrent);
      renderRadar(
        { ...envCurrent?.environment, ...envCurrent?.noise },
        avgReq(currentArtworks)
      );
    } catch { /* silent */ }
  });
});
