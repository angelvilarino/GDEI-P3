let dashboardMap;
let trendChart;

function markerColor(status) {
  if (status === 'critical') return '#b5443c';
  if (status === 'attention') return '#a86b18';
  return '#26875f';
}

function mapIcon(status) {
  const color = markerColor(status);
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 3px ${color}55"></div>`,
    iconSize: [18, 18],
  });
}

async function loadSummary() {
  const data = await apiGet('/api/dashboard/summary');
  const kpi = data.kpis;
  document.getElementById('kpiVisitors').textContent = kpi.visitorsTotal;
  document.getElementById('kpiRooms').textContent = `${kpi.roomsOptimalPct}%`;
  document.getElementById('kpiRisk').textContent = kpi.artworksAtRisk;
  document.getElementById('kpiSensors').textContent = `${kpi.sensorsActive}/${kpi.sensorsTotal}`;
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

  if (window._centerLayer) {
    window._centerLayer.forEach((m) => m.remove());
  }
  window._centerLayer = [];

  centers.forEach((center) => {
    const coords = center.location.coordinates;
    const marker = L.marker([coords[1], coords[0]], { icon: mapIcon(center.status) }).addTo(dashboardMap);
    marker.bindPopup(`
      <strong>${center.name}</strong><br/>
      <img src="${center.image}" alt="${center.name}" style="width:180px;border-radius:8px;margin-top:6px"/><br/>
      Temp: ${formatNumber(center.snapshot.avgTemperature)} C<br/>
      CO2: ${formatNumber(center.snapshot.avgCo2)} ppm<br/>
      Estado: ${center.status}
    `);
    marker.on('click', () => {
      window.location.href = `/center/${center.code}`;
    });
    window._centerLayer.push(marker);
  });
}

async function loadTrend() {
  const centers = await apiGet('/api/centers');
  const centerData = await Promise.all(
    centers.map((center) => apiGet(`/api/centers/${center.code}/trend?range=12h`))
  );

  const allTemp = [];
  const allPeople = [];
  centerData.forEach((d) => {
    d.temperature.forEach((p) => allTemp.push(Number(p.value)));
    d.peopleCount.forEach((p) => allPeople.push(Number(p.value)));
  });

  const labels = Array.from({ length: 12 }, (_, i) => `${i + 1}h`);
  const tempData = labels.map((_, i) => {
    const idx = Math.floor((allTemp.length * i) / labels.length);
    return Number(allTemp[idx] || 0);
  });
  const peopleData = labels.map((_, i) => {
    const idx = Math.floor((allPeople.length * i) / labels.length);
    return Number(allPeople[idx] || 0);
  });

  if (trendChart) trendChart.destroy();
  const ctx = document.getElementById('trendChart');
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: tr('temperature'),
          data: tempData,
          borderColor: '#0e7c74',
          backgroundColor: '#0e7c7422',
          tension: 0.28,
          yAxisID: 'y',
        },
        {
          label: tr('occupancy'),
          data: peopleData,
          borderColor: '#d27d3f',
          backgroundColor: '#d27d3f22',
          tension: 0.25,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { position: 'left', title: { display: true, text: 'C' } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'people' } },
      },
    },
  });
}

function renderAlerts(alerts) {
  const panel = document.getElementById('alertsPanel');
  if (!alerts.length) {
    panel.innerHTML = `<div class="small">${tr('noData')}</div>`;
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
  const code = `graph TD\nMuseum-->Room\nRoom-->Artwork\nRoom-->Device\nRoom-->Actuator\nDevice-->IndoorEnvironmentObserved\nDevice-->NoiseLevelObserved\nDevice-->CrowdFlowObserved\nAlert-->Room`;
  el.textContent = code;
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
