let gaugeCharts = {};
let historyCharts = {};

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
      (r) => {
        const fallbackImg = `https://images.unsplash.com/photo-1554941068-a252680d25d9?auto=format&fit=crop&q=80&w=400&h=200&museum=${encodeURIComponent(r.roomType)}`;
        return `
      <div class="card room-card">
        <img class="room-img" src="${r.image || fallbackImg}" alt="${escapeHtml(r.name)}" />
        <div class="room-info">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <strong>${escapeHtml(r.name)}</strong>
            ${statusBadge(r.status)}
          </div>
          <div class="small">${tr('occupancy')}: ${formatMetric(Number(r.current.occupancy || 0) * 100, { digits: 0, unit: '%', zeroAsMissing: false })}</div>
          <a class="btn" href="/room/${encodeURIComponent(r.id)}" style="margin-top:8px; width: 100%; text-align: center;">${tr('viewDetail')}</a>
        </div>
      </div>
    `;
      }
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

function buildSingleChart(id, label, data, labels, color, unit) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (historyCharts[id]) historyCharts[id].destroy();
  historyCharts[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: label,
        data: data,
        borderColor: color,
        backgroundColor: `${color}22`,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return `${label}: ${formatMetric(context.parsed.y, { digits: 1, unit, zeroAsMissing: false })}`;
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: false }
      }
    }
  });
}

async function loadHistory(code) {
  const range = document.getElementById('rangeSelect').value;
  const history = await apiGet(`/api/centers/${code}/history?range=${range}`);
  const labels = history.temperature.map((p) => formatTimestampLabel(p.timestamp));

  buildSingleChart('chartTemp', tr('temperature'), history.temperature.map(p => p.value), labels, '#0e7c74', '°C');
  buildSingleChart('chartHum', tr('humidity'), history.relativeHumidity.map(p => p.value), labels, '#3d9ecf', '%');
  buildSingleChart('chartCo2', tr('co2'), history.co2.map(p => p.value), labels, '#d27d3f', 'ppm');
  buildSingleChart('chartNoise', 'Noise (LAeq)', history.LAeq.map(p => p.value), labels, '#7c5bd6', 'dB');
  buildSingleChart('chartCrowd', tr('occupancy'), history.peopleCount.map(p => p.value), labels, '#a86b18', 'pax');
}

async function loadActuators(code) {
  const acts = await apiGet(`/api/centers/${code}/actuators`);
  const wrap = document.getElementById('actuatorPanel');
  wrap.innerHTML = acts
    .map(
      (a) => `
      <div class="card" style="padding:10px; align-self: stretch;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <strong>${a.name || a.id}</strong>
          <span class="pill">${a.status || 'off'}</span>
        </div>
        <div class="controls-row" style="margin-top:8px">
          <button class="btn btn-primary" data-act="${a.id}" data-cmd="on" style="flex:1">ON</button>
          <button class="btn" data-act="${a.id}" data-cmd="off" style="flex:1">OFF</button>
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
  socket.on('alerts', () => {
    loadRiskArtworks(code);
    loadCenterSnapshot(code);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'center-detail') return;
  bootCenterDetail().catch((err) => console.error(err));
});
