let dashboardMap;
let trendChart;

function markerIcon(status) {
  const color = markerColor(status);
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 3px ${color}55"></div>`,
    iconSize: [18, 18],
  });
}

function markerColor(status) {
  if (status === 'critical') return '#b5443c';
  if (status === 'attention') return '#a86b18';
  return '#26875f';
}

function statusLabel(status) {
  return tr(status || 'attention');
}

function buildCenterPopup(center) {
  const snap = center.snapshot || {};
  return `
    <div class="center-popup">
      <strong>${escapeHtml(center.name)}</strong>
      <div class="small" style="margin-top:4px">${escapeHtml(center.type || '')}</div>
      <img src="${escapeHtml(center.image || '')}" alt="${escapeHtml(center.name)}" style="width:220px;height:140px;object-fit:cover;border-radius:10px;margin-top:8px" />
      <div style="margin-top:8px">${statusBadge(center.status)}</div>
      <div class="grid grid-2" style="margin-top:8px;gap:6px">
        <div>${tr('temperature')}: <strong>${formatMetric(snap.avgTemperature, { unit: '°C' })}</strong></div>
        <div>${tr('humidity')}: <strong>${formatMetric(snap.avgHumidity, { unit: '%' })}</strong></div>
        <div>${tr('co2')}: <strong>${formatMetric(snap.avgCo2, { digits: 0, unit: 'ppm' })}</strong></div>
        <div>${tr('occupancy')}: <strong>${formatMetric(snap.avgOccupancy, { digits: 0, unit: '%', zeroAsMissing: false })}</strong></div>
      </div>
    </div>
  `;
}

async function loadSummary() {
  const data = await apiGet('/api/dashboard/summary');
  const kpi = data.kpis;
  document.getElementById('kpiVisitors').textContent = formatMetric(kpi.visitorsTotal, { digits: 0, zeroAsMissing: false });
  document.getElementById('kpiRooms').textContent = `${formatMetric(kpi.roomsOptimalPct, { digits: 2, zeroAsMissing: false })}%`;
  document.getElementById('kpiRisk').textContent = formatMetric(kpi.artworksAtRisk, { digits: 0, zeroAsMissing: false });
  document.getElementById('kpiSensors').textContent = `${formatMetric(kpi.sensorsActive, { digits: 0, zeroAsMissing: false })}/${formatMetric(kpi.sensorsTotal, { digits: 0, zeroAsMissing: false })}`;
}

async function loadCentersMap() {
  const centers = await apiGet('/api/centers');
  if (!dashboardMap) {
    dashboardMap = L.map('globalMap').setView([43.3705, -8.4075], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(dashboardMap);
  }

  if (window._centerMarkers) {
    window._centerMarkers.forEach((m) => m.remove());
  }
  window._centerMarkers = [];

  centers.forEach((center) => {
    const coords = center.location.coordinates;
    const marker = L.marker([coords[1], coords[0]], { icon: markerIcon(center.status) }).addTo(dashboardMap);
    marker.bindPopup(buildCenterPopup(center), { closeButton: false, autoClose: false, className: 'center-popup-wrap' });
    marker.on('mouseover', () => marker.openPopup());
    marker.on('mouseout', () => marker.closePopup());
    marker.on('click', () => {
      window.location.href = `/centers/${center.code}`;
    });
    window._centerMarkers.push(marker);
  });
}

async function loadTrend() {
  const centers = await apiGet('/api/centers');
  const centerData = await Promise.all(centers.map((center) => apiGet(`/api/centers/${center.code}/trend?range=12h`)));

  const temperatureBuckets = new Map();
  const peopleBuckets = new Map();
  centerData.forEach((series) => {
    (series.temperature || []).forEach((point) => {
      const key = point.timestamp;
      if (!temperatureBuckets.has(key)) temperatureBuckets.set(key, []);
      temperatureBuckets.get(key).push(Number(point.value));
    });
    (series.peopleCount || []).forEach((point) => {
      const key = point.timestamp;
      if (!peopleBuckets.has(key)) peopleBuckets.set(key, []);
      peopleBuckets.get(key).push(Number(point.value));
    });
  });

  const labelsSource = Array.from(new Set([...temperatureBuckets.keys(), ...peopleBuckets.keys()])).filter(Boolean).sort();
  if (!labelsSource.length) {
    const canvas = document.getElementById('trendChart');
    if (canvas && canvas.parentElement) {
      canvas.parentElement.innerHTML = `<div class="empty-state">${tr('noDataAvailable')}</div>`;
    }
    return;
  }

  const average = (points) => (points && points.length ? points.reduce((sum, value) => sum + value, 0) / points.length : null);
  const tempData = labelsSource.map((timestamp) => average(temperatureBuckets.get(timestamp)));
  const peopleData = labelsSource.map((timestamp) => average(peopleBuckets.get(timestamp)));
  const labels = labelsSource.map((timestamp) => formatTimestampLabel(timestamp));
  const latest = labelsSource[labelsSource.length - 1];
  const earliest = labelsSource[0];

  if (trendChart) trendChart.destroy();
  const ctx = document.getElementById('trendChart');
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: tr('temperatureWithUnit'),
          data: tempData,
          borderColor: '#0e7c74',
          backgroundColor: '#0e7c7422',
          tension: 0.28,
          yAxisID: 'y',
          unit: '°C',
        },
        {
          label: tr('occupancyWithUnit'),
          data: peopleData,
          borderColor: '#d27d3f',
          backgroundColor: '#d27d3f22',
          tension: 0.25,
          yAxisID: 'y1',
          unit: tr('occupancy'),
        },
        {
          label: tr('criticalTemp'),
          data: labels.map(() => 25),
          borderColor: '#b5443c',
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          yAxisID: 'y',
          unit: '°C',
        },
        {
          label: tr('criticalOccupancy'),
          data: labels.map(() => Math.max(...peopleData.filter((v) => v !== null), 1) * 0.85),
          borderColor: '#a86b18',
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          yAxisID: 'y1',
          unit: tr('occupancy'),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom' },
        title: {
          display: true,
          text: `${tr('last12Hours')} — ${tr('from')} ${formatTimestampLabel(earliest)} ${tr('to')} ${formatTimestampLabel(latest)}`,
        },
        tooltip: {
          callbacks: {
            label(context) {
              const unit = context.dataset.unit || '';
              const value = context.parsed.y;
              if (value === null || value === undefined) return `${context.dataset.label}: ${tr('noData')}`;
              return `${context.dataset.label}: ${formatMetric(value, { digits: 1, unit, zeroAsMissing: false })}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'HH:MM' },
        },
        y: { position: 'left', title: { display: true, text: '°C' } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: tr('occupancy') } },
      },
    },
  });
}

function renderAlerts(alerts) {
  const panel = document.getElementById('alertsPanel');
  if (!alerts.length) {
    panel.innerHTML = `<div class="small">${tr('noAlerts')}</div>`;
    return;
  }
  panel.innerHTML = alerts
    .slice(0, 30)
    .map(
      (a) => `
      <div class="alert-item ${a.severity === 'critical' ? 'critical' : ''}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
          <div>
            <strong>${a.subCategory || 'Alert'}</strong><br/>
            <span class="small">${a.description || ''}</span>
          </div>
          <button class="btn" data-alert-id="${a.id}">${tr('resolve')}</button>
        </div>
      </div>
    `
    )
    .join('');

  panel.querySelectorAll('button[data-alert-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-alert-id');
      await apiSend(`/api/alerts/${encodeURIComponent(id)}/resolve`, 'PATCH');
      await loadAlerts();
    });
  });
}

async function loadAlerts() {
  const alerts = await apiGet('/api/admin/alerts?status=open');
  renderAlerts(alerts);
}

function loadMermaid() {
  const el = document.getElementById('modelMermaid');
  const graph = {
    Museum: 'museum',
    Room: 'room',
    Artwork: 'artwork',
    Device: 'device',
    Actuator: 'actuator',
    IndoorEnvironmentObserved: 'envNode',
    NoiseLevelObserved: 'noise',
    CrowdFlowObserved: 'crowd',
    Alert: 'alert',
  };
  const lines = ['flowchart TD'];
  graph.Museum && lines.push('  museum["Museum"]');
  graph.Room && lines.push('  room["Room"]');
  graph.Artwork && lines.push('  artwork["Artwork"]');
  graph.Device && lines.push('  device["Device"]');
  graph.Actuator && lines.push('  actuator["Actuator"]');
  graph.IndoorEnvironmentObserved && lines.push('  envNode["IndoorEnvironmentObserved"]');
  graph.NoiseLevelObserved && lines.push('  noise["NoiseLevelObserved"]');
  graph.CrowdFlowObserved && lines.push('  crowd["CrowdFlowObserved"]');
  graph.Alert && lines.push('  alert["Alert"]');
  lines.push('  museum -->|contains| room');
  lines.push('  room -->|exposes| artwork');
  lines.push('  room -->|hosts| device');
  lines.push('  room -->|contains| actuator');
  lines.push('  device -->|observes| envNode');
  lines.push('  device -->|observes| noise');
  lines.push('  device -->|observes| crowd');
  lines.push('  alert -->|relates| room');
  el.textContent = lines.join('\n');
  mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
  mermaid.run({ nodes: [el] });

  const toggle = document.getElementById('toggleMermaid');
  const body = document.getElementById('mermaidBody');
  toggle.addEventListener('click', () => {
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
  });
}

async function bootDashboard() {
  await Promise.all([loadSummary(), loadCentersMap(), loadTrend(), loadAlerts()]);
  loadMermaid();

  const socket = ensureSocket();
  socket.on('alerts', () => loadAlerts());
  socket.on('update', () => loadSummary());
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') === 'dashboard') {
    bootDashboard().catch((err) => console.error(err));
  }
});
