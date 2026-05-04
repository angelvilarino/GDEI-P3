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

function setKpiText(id, value, max, color, label) {
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

  document.getElementById('gTemp-value').textContent = formatMetric(snap.avgTemperature, { digits: 1, zeroAsMissing: true });
  document.getElementById('gHum-value').textContent = formatMetric(snap.avgHumidity, { digits: 1, zeroAsMissing: true });
  document.getElementById('gCo2-value').textContent = formatMetric(snap.avgCo2, { digits: 0, zeroAsMissing: true });
  document.getElementById('gNoise-value').textContent = formatMetric(snap.avgNoise, { digits: 1, zeroAsMissing: true });
  
  let occPct = snap.avgOccupancy ? snap.avgOccupancy * 100 : null;
  document.getElementById('gOcc-value').textContent = formatMetric(snap.peopleCount || 0, { digits: 0, zeroAsMissing: false });
  document.getElementById('gOcc-pct').textContent = formatMetric(occPct, { digits: 0, zeroAsMissing: false });
}

async function loadRooms(code) {
  const rooms = await apiGet(`/api/centers/${code}/rooms`);
  const list = document.getElementById('roomsList');
  const FALLBACK_IMG = 'https://picsum.photos/id/376/400/200';
  list.innerHTML = rooms
    .map(
      (r) => `
      <div class="card room-card">
        <img class="room-img" src="${r.image || FALLBACK_IMG}" alt="${escapeHtml(r.name)}" onerror="this.src='${FALLBACK_IMG}'" />
        <div class="room-info">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <strong>${escapeHtml(r.name)}</strong>
            ${statusBadge(r.status)}
          </div>
          <div class="small">${tr('occupancy')}: ${formatMetric(Number(r.current.occupancy || 0) * 100, { digits: 0, unit: '%', zeroAsMissing: false })}</div>
          <a class="btn room-btn" href="/room/${encodeURIComponent(r.id)}">${tr('viewDetail')}</a>
        </div>
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

function buildSingleChart(id, label, data, rawLabels, color, unit, range) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (historyCharts[id]) historyCharts[id].destroy();
  historyCharts[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rawLabels,
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
            title(context) {
                const ts = context[0].label;
                const d = new Date(ts);
                if (Number.isNaN(d.getTime())) return ts;
                return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            },
            label(context) {
              return `${label}: ${formatMetric(context.parsed.y, { digits: 1, unit, zeroAsMissing: false })}`;
            }
          }
        }
      },
      scales: {
        x: {
            ticks: {
                maxRotation: 0,
                autoSkip: false,
                callback: function(val, index) {
                    const ts = rawLabels[index];
                    if (!ts) return '';
                    const d = new Date(ts);
                    if (Number.isNaN(d.getTime())) return '';
                    
                    const m = d.getMinutes();
                    const h = d.getHours();
                    const s = d.getSeconds();

                    if (range === '1h') {
                        // cada 10 min
                        if (m % 10 === 0 && s < 30) {
                            return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        }
                    } else if (range === '12h') {
                        // cada hora
                        if (m === 0) {
                            return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                        }
                    } else if (range === '24h') {
                        // cada 2 horas
                        if (h % 2 === 0 && m === 0) {
                            return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                        }
                    }
                    return '';
                }
            }
        },
        y: { beginAtZero: false }
      }
    }
  });
}

async function loadHistory(code) {
  const range = document.getElementById('rangeSelect').value;
  const history = await apiGet(`/api/centers/${code}/history?range=${range}`);
  const rawLabels = history.temperature.map(p => p.timestamp);

  buildSingleChart('chartTemp', tr('temperature'), history.temperature.map(p => p.value), rawLabels, '#0e7c74', '°C', range);
  buildSingleChart('chartHum', tr('humidity'), history.relativeHumidity.map(p => p.value), rawLabels, '#3d9ecf', '%', range);
  buildSingleChart('chartCo2', tr('co2'), history.co2.map(p => p.value), rawLabels, '#d27d3f', 'ppm', range);
  buildSingleChart('chartNoise', 'Noise (LAeq)', history.LAeq.map(p => p.value), rawLabels, '#7c5bd6', 'dB', range);
  buildSingleChart('chartCrowd', tr('occupancy'), history.peopleCount.map(p => p.value), rawLabels, '#a86b18', 'pax', range);
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
  const frame = document.getElementById('grafanaFrame');
  const errorDiv = document.getElementById('grafanaError');
  try {
    const info = await apiGet(`/api/grafana/center/${code}`);
    if (!info || !info.embed) throw new Error('no embed URL');
    frame.src = info.embed;
    frame.style.display = 'block';
    if (errorDiv) errorDiv.style.display = 'none';
    frame.onerror = () => {
      frame.style.display = 'none';
      if (errorDiv) errorDiv.style.display = '';
    };
  } catch (_) {
    frame.style.display = 'none';
    if (errorDiv) errorDiv.style.display = '';
  }
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
