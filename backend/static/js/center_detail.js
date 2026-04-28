let gaugeCharts = {};
let historyChart;

function centerCodeFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[1];
}

function gaugeConfig(value, max, color) {
  return {
    type: 'doughnut',
    data: {
      labels: ['value', 'rest'],
      datasets: [
        {
          data: [Math.max(0, Math.min(max, value)), Math.max(0, max - value)],
          backgroundColor: [color, '#d8d8d833'],
          borderWidth: 0,
          cutout: '72%',
        },
      ],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      responsive: true,
      maintainAspectRatio: false,
    },
  };
}

function upsertGauge(id, value, max, color, label) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (gaugeCharts[id]) gaugeCharts[id].destroy();
  gaugeCharts[id] = new Chart(ctx, gaugeConfig(value, max, color));
  document.getElementById(`${id}-value`).textContent = `${formatMetric(value, { digits: 1, zeroAsMissing: true })} ${label}`;
}

async function loadCenterSnapshot(code) {
  const center = await apiGet(`/api/centers/${code}`);
  const snap = center.snapshot;
  document.getElementById('centerTitle').textContent = center.name;
  document.getElementById('centerStatus').innerHTML = statusBadge(snap.status);

  upsertGauge('gTemp', snap.avgTemperature, 35, '#0e7c74', '°C');
  upsertGauge('gHum', snap.avgHumidity, 100, '#3d9ecf', '%');
  upsertGauge('gCo2', snap.avgCo2, 1800, '#d27d3f', 'ppm');
  upsertGauge('gNoise', snap.avgNoise, 100, '#7c5bd6', 'dB');
  upsertGauge('gOcc', snap.avgOccupancy ? snap.avgOccupancy * 100 : null, 100, '#a86b18', '%');
}

async function loadRooms(code) {
  const rooms = await apiGet(`/api/centers/${code}/rooms`);
  const list = document.getElementById('roomsList');
  list.innerHTML = rooms
    .map(
      (r) => `
      <div class="card" style="padding:10px">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <strong>${escapeHtml(r.name)}</strong>
          ${statusBadge(r.status)}
        </div>
        <div class="small">${tr('occupancy')}: ${formatMetric(Number(r.current.occupancy || 0) * 100, { digits: 0, unit: '%', zeroAsMissing: false })}</div>
        <a class="btn" href="/room/${encodeURIComponent(r.id)}" style="margin-top:8px">${tr('viewDetail')}</a>
      </div>
    `
    )
    .join('');
}

async function loadRiskArtworks(code) {
  const arts = await apiGet(`/api/centers/${code}/artworks/at-risk`);
  const list = document.getElementById('riskList');
  list.innerHTML = arts.length
    ? arts
        .slice(0, 12)
        .map(
          (a) => `<div class="alert-item ${Number(a.degradationRisk) > 0.8 ? 'critical' : ''}"><strong>${escapeHtml(a.name)}</strong><br/><span class="small">${escapeHtml(a.artist || '')} · ${tr('severity')} ${formatMetric(a.degradationRisk, { digits: 3, zeroAsMissing: false })}</span></div>`
        )
        .join('')
    : `<div class="small">${tr('noDataAvailable')}</div>`;
}

async function loadHistory(code) {
  const range = document.getElementById('rangeSelect').value;
  const history = await apiGet(`/api/centers/${code}/history?range=${range}`);
  const labels = history.temperature.map((p) => formatTimestampLabel(p.timestamp));

  const dataSets = [
    { key: 'temperature', color: '#0e7c74', label: tr('temperature') },
    { key: 'relativeHumidity', color: '#3d9ecf', label: tr('humidity') },
    { key: 'co2', color: '#d27d3f', label: tr('co2') },
    { key: 'LAeq', color: '#7c5bd6', label: 'LAeq' },
    { key: 'peopleCount', color: '#a86b18', label: tr('occupancy') },
  ];

  const datasets = dataSets.map((s) => ({
    label: s.label,
    data: history[s.key].map((p) => (p.value === null || p.value === undefined ? null : Number(p.value))),
    borderColor: s.color,
    backgroundColor: `${s.color}22`,
    fill: false,
    tension: 0.2,
    pointRadius: 0,
  }));

  if (historyChart) historyChart.destroy();
  historyChart = new Chart(document.getElementById('historyChart'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatMetric(context.parsed.y, { digits: 1, zeroAsMissing: false })}`;
            },
          },
        },
      },
    },
  });
}

async function loadActuators(code) {
  const acts = await apiGet(`/api/centers/${code}/actuators`);
  const wrap = document.getElementById('actuatorPanel');
  wrap.innerHTML = acts
    .map(
      (a) => `
      <div class="card" style="padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <strong>${a.name || a.id}</strong>
          <span class="pill">${a.status || 'off'}</span>
        </div>
        <div class="controls-row" style="margin-top:8px">
          <button class="btn btn-primary" data-act="${a.id}" data-cmd="on">ON</button>
          <button class="btn" data-act="${a.id}" data-cmd="off">OFF</button>
        </div>
      </div>
    `
    )
    .join('');

  wrap.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-act');
      const cmd = btn.getAttribute('data-cmd');
      await apiSend(`/api/actuators/${encodeURIComponent(id)}/command`, 'POST', { command: cmd });
      await loadActuators(code);
    });
  });
}

async function loadGrafana(code) {
  const info = await apiGet(`/api/grafana/center/${code}`);
  document.getElementById('grafanaFrame').src = info.embed;
}

async function bootCenterDetail() {
  const code = centerCodeFromPath();
  await Promise.all([
    loadCenterSnapshot(code),
    loadRooms(code),
    loadRiskArtworks(code),
    loadHistory(code),
    loadActuators(code),
    loadGrafana(code),
  ]);

  document.getElementById('rangeSelect').addEventListener('change', () => loadHistory(code));

  const socket = ensureSocket();
  socket.on('update', () => loadCenterSnapshot(code));
  socket.on('actuators', () => loadActuators(code));
  socket.on('alerts', () => loadRiskArtworks(code));
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'center-detail') return;
  bootCenterDetail().catch((err) => console.error(err));
});
