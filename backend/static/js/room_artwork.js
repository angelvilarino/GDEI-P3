let radarChart;
let tempChart, humidityChart, co2Chart, noiseChart;
let currentRange = '24h';

function roomIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[1]);
}

function avgReq(artworks) {
  if (!artworks.length) {
    return { temperature: 21, humidity: 50, co2: 800, illuminance: 120, noise: 55 };
  }
  const sum = artworks.reduce(
    (acc, a) => {
      const req = a.conservationRequirements || {};
      acc.temperature += (Number(req.temperatureMin || 18) + Number(req.temperatureMax || 22)) / 2;
      acc.humidity += (Number(req.humidityMin || 45) + Number(req.humidityMax || 55)) / 2;
      acc.co2 += Number(req.co2Max || 900);
      acc.illuminance += Number(req.illuminanceMax || 150);
      acc.noise += Number(req.noiseMax || 60);
      return acc;
    },
    { temperature: 0, humidity: 0, co2: 0, illuminance: 0, noise: 0 }
  );
  const n = artworks.length;
  return {
    temperature: sum.temperature / n,
    humidity: sum.humidity / n,
    co2: sum.co2 / n,
    illuminance: sum.illuminance / n,
    noise: sum.noise / n,
  };
}

function statusBadge(status) {
  const classes = {
    ok: 'ok',
    warn: 'warn',
    danger: 'danger'
  };
  const labels = {
    ok: 'Buen Estado',
    warn: 'Advertencia',
    danger: 'Crítico'
  };
  return `<span class="status-badge ${classes[status] || 'ok'}">${labels[status] || 'Desconocido'}</span>`;
}

function renderRadar(current, optimal) {
  const labels = [tr('temperature'), tr('humidity'), tr('co2'), tr('lux'), tr('decibel')];
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
          label: tr('actual'),
          data: cVals,
          borderColor: '#0e7c74',
          backgroundColor: '#0e7c7430',
        },
        {
          label: tr('optimalLabel'),
          data: oVals,
          borderColor: '#d27d3f',
          backgroundColor: '#d27d3f28',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { r: { beginAtZero: true } },
    },
  });
}

function renderArtworkTable(artworks) {
  const tbody = document.getElementById('artworksTableBody');
  tbody.innerHTML = artworks
    .map(
      (a) => `
      <tr>
        <td><input type="checkbox" data-art-id="${a.id}"/></td>
        <td><img src="${a.image}" alt="${a.name}"/></td>
        <td>${a.name}</td>
        <td>${a.artist || '-'}</td>
        <td>${a.material || '-'}</td>
        <td>${formatMetric(a.degradationRisk, { digits: 3, zeroAsMissing: false })}</td>
        <td>${formatMetric(a.stressAccumulated || 0, { digits: 2 })}</td>
        <td>${a.conditionStatus || 'Buena'}</td>
      </tr>
    `
    )
    .join('');
}

function renderIndividualCharts(history) {
  const labels = history.temperature.map(p => p.timestamp);

  // Temperature Chart
  if (tempChart) tempChart.destroy();
  tempChart = new Chart(document.getElementById('tempChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Temperatura (°C)',
        data: history.temperature.map(p => p.value),
        borderColor: '#0e7c74',
        pointRadius: 0,
        tension: 0.22,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { callback: formatTimeAxis } },
        y: { beginAtZero: false }
      },
      plugins: { legend: { display: false } }
    },
  });

  // Humidity Chart
  if (humidityChart) humidityChart.destroy();
  humidityChart = new Chart(document.getElementById('humidityChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Humedad (%)',
        data: history.relativeHumidity.map(p => p.value),
        borderColor: '#3d9ecf',
        pointRadius: 0,
        tension: 0.22,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { callback: formatTimeAxis } },
        y: { beginAtZero: false }
      },
      plugins: { legend: { display: false } }
    },
  });

  // CO2 Chart
  if (co2Chart) co2Chart.destroy();
  co2Chart = new Chart(document.getElementById('co2Chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'CO2 (ppm)',
        data: history.co2.map(p => p.value),
        borderColor: '#d27d3f',
        pointRadius: 0,
        tension: 0.22,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { callback: formatTimeAxis } },
        y: { beginAtZero: false }
      },
      plugins: { legend: { display: false } }
    },
  });

  // Noise Chart
  if (noiseChart) noiseChart.destroy();
  noiseChart = new Chart(document.getElementById('noiseChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ruido (dB)',
        data: history.LAeq ? history.LAeq.map(p => p.value) : [],
        borderColor: '#a86b18',
        pointRadius: 0,
        tension: 0.22,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { callback: formatTimeAxis } },
        y: { beginAtZero: false }
      },
      plugins: { legend: { display: false } }
    },
  });
}

function formatTimeAxis(value, index, values) {
  const ts = values[index];
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';

  const range = currentRange;
  const m = d.getMinutes();
  const h = d.getHours();

  if (range === '1h') {
    if (m % 10 === 0) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } else if (range === '6h' || range === '12h') {
    if (m === 0) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } else if (range === '24h') {
    if (h % 2 === 0 && m === 0) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  return '';
}

function renderAlertsTimeline(alerts) {
  const timeline = document.getElementById('alertsTimeline');
  if (!alerts || !alerts.length) {
    timeline.innerHTML = '<p class="small">No hay alertas recientes.</p>';
    return;
  }

  timeline.innerHTML = alerts.map(alert => `
    <div class="timeline-item">
      <div class="timeline-marker"></div>
      <div class="timeline-content">
        <h5>${alert.description || 'Alerta'}</h5>
        <p>${alert.cause || 'Causa desconocida'}</p>
        <div class="timestamp">${new Date(alert.timestamp).toLocaleString('es-ES')}</div>
        <div class="small">Estado: ${alert.resolved ? 'Resuelta' : 'Activa'}</div>
      </div>
    </div>
  `).join('');
}

async function loadRoomView() {
  const roomId = roomIdFromPath();
  const [room, envCurrent, artworks, history] = await Promise.all([
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}`),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/environment/current`),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/artworks`),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/history?range=${currentRange}`),
  ]);

  document.getElementById('roomName').textContent = room.name;
  document.getElementById('roomMeta').textContent = `${room.area} m² · Capacidad: ${room.capacity}`;
  document.getElementById('roomStatus').innerHTML = statusBadge(room.status);

  renderRadar({ ...envCurrent.environment, ...envCurrent.noise }, avgReq(artworks));
  renderArtworkTable(artworks);
  renderIndividualCharts(history);
  renderAlertsTimeline([]); // Mock empty alerts for now
}

async function changeRange(range) {
  currentRange = range;
  document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-range="${range}"]`).classList.add('active');
  await loadRoomView();
}

async function compareSelected() {
  const checked = Array.from(document.querySelectorAll('input[data-art-id]:checked')).map(el => el.getAttribute('data-art-id'));
  const ids = checked.slice(0, 3);
  if (!ids.length) {
    alert('Selecciona al menos una obra para comparar.');
    return;
  }

  const data = await apiGet(`/api/artworks/compare?ids=${ids.map(encodeURIComponent).join(',')}`);
  const modal = document.getElementById('compareModal');
  const compareWrap = document.getElementById('compareWrap');
  compareWrap.innerHTML = data.map(a => `
    <article class="card">
      <img src="${a.image}" alt="${a.name}" style="width:100%;height:130px;object-fit:cover;border-radius:8px"/>
      <h4>${a.name}</h4>
      <div class="small">${a.artist || ''}</div>
      <div style="margin-top:8px">Riesgo Degradación: <strong>${formatMetric(a.degradationRisk, { digits: 3, zeroAsMissing: false })}</strong></div>
      <div class="pill" style="margin-top:8px">Estado: ${a.conditionStatus || 'Buena'}</div>
    </article>
  `).join('');
  modal.style.display = 'flex';
}

function wireActions() {
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => changeRange(btn.getAttribute('data-range')));
  });

  document.getElementById('compareBtn').addEventListener('click', compareSelected);

  document.getElementById('selectAll').addEventListener('change', (e) => {
    document.querySelectorAll('input[data-art-id]').forEach(cb => cb.checked = e.target.checked);
  });

  // Modal close
  document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('compareModal').style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('compareModal')) {
      document.getElementById('compareModal').style.display = 'none';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'room-artwork') return;
  wireActions();
  loadRoomView().catch(err => console.error(err));
  ensureSocket().on('update', () => loadRoomView());
});
