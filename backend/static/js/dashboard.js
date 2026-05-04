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

function updateKPIs(kpi) {
  if (!kpi) return;
  document.getElementById('kpiVisitors').textContent = formatMetric(kpi.visitorsTotal, { digits: 0, zeroAsMissing: false });
  document.getElementById('kpiRooms').textContent = `${formatMetric(kpi.roomsOptimalPct, { digits: 2, zeroAsMissing: false })}%`;
  document.getElementById('kpiRisk').textContent = formatMetric(kpi.artworksAtRisk, { digits: 0, zeroAsMissing: false });
  document.getElementById('kpiSensors').textContent = `${formatMetric(kpi.sensorsActive, { digits: 0, zeroAsMissing: false })}/${formatMetric(kpi.sensorsTotal, { digits: 0, zeroAsMissing: false })}`;
}

async function loadSummary() {
  const data = await apiGet('/api/dashboard/summary');
  updateKPIs(data.kpis);
  document.querySelectorAll('.kpi .value').forEach((el) => el.classList.remove('skeleton'));
}

function parseSensorStatusResponse(data) {
  return {
    active: Number(data.active ?? data.activeCount ?? data.sensorsActive ?? 0),
    total: Number(data.total ?? data.totalCount ?? data.sensorsTotal ?? 0),
  };
}

async function loadSensorsStatus() {
  const data = await apiGet('/api/sensors/status');
  const { active, total } = parseSensorStatusResponse(data);
  const kpiSensors = document.getElementById('kpiSensors');
  kpiSensors.textContent = `${formatMetric(active, { digits: 0, zeroAsMissing: false })}/${formatMetric(total, { digits: 0, zeroAsMissing: false })}`;
  kpiSensors.classList.remove('skeleton');
}

async function loadCentersMap() {
  const mapContainer = document.getElementById('globalMap');
  const centers = await apiGet('/api/centers');
  mapContainer.style.opacity = '0';
  mapContainer.style.display = 'block';
  if (!dashboardMap) {
    dashboardMap = L.map('globalMap').setView([43.3705, -8.4075], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(dashboardMap);
  } else {
    dashboardMap.invalidateSize();
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

  document.getElementById('mapSkeleton').style.display = 'none';
  mapContainer.style.opacity = '1';
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
    document.getElementById('chartSkeleton').style.display = 'none';
    const canvas = document.getElementById('trendChart');
    if (canvas && canvas.parentElement) {
      canvas.parentElement.innerHTML = `<div class="empty-state">${tr('noDataAvailable')}</div>`;
    }
    return;
  }

  const average = (points) => (points && points.length ? points.reduce((sum, value) => sum + value, 0) / points.length : null);
  const tempData = labelsSource.map((timestamp) => average(temperatureBuckets.get(timestamp)));
  const peopleData = labelsSource.map((timestamp) => average(peopleBuckets.get(timestamp)));
  const labels = labelsSource.map((timestamp) => formatTimestampLabel(timestamp, '24h'));
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
          text: `${tr('last12Hours')} — Evolución agregada de los 4 centros — ${tr('from')} ${formatTimestampLabel(earliest, '24h')} ${tr('to')} ${formatTimestampLabel(latest, '24h')}`,
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

  // Ocultar skeleton de la gráfica
  document.getElementById('chartSkeleton').style.display = 'none';
  document.getElementById('trendChart').style.display = 'block';
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
  if (typeof mermaid === 'undefined') {
    setTimeout(loadMermaid, 500);
    return;
  }
  mermaid.initialize({ startOnLoad: false, theme: 'default' });
  mermaid.run({ nodes: document.querySelectorAll('.mermaid') }).catch((err) => console.error('Mermaid error:', err));
}

async function bootDashboard() {
  const summaryPromise = loadSummary();
  const mapPromise = loadCentersMap();
  const alertsPromise = loadAlerts();
  const sensorsPromise = loadSensorsStatus();

  await Promise.all([summaryPromise, mapPromise]);
  loadTrend().catch((err) => console.error(err));

  await Promise.allSettled([alertsPromise, sensorsPromise]);
  loadMermaid();

  const socket = ensureSocket();
  socket.on('alerts', () => loadAlerts());
  socket.on('summary', (data) => updateKPIs(data.kpis));
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') === 'dashboard') {
    bootDashboard().catch((err) => console.error(err));
  }
});
