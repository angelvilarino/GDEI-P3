let radarChart;
let roomHistoryChart;

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
        <td><img src="${a.image}" alt="${a.name}" style="width:58px;height:42px;object-fit:cover;border-radius:6px"/></td>
        <td>${a.name}</td>
        <td>${a.artist || '-'}</td>
        <td>${a.material || '-'}</td>
        <td>${formatMetric(a.degradationRisk, { digits: 3, zeroAsMissing: false })}</td>
      </tr>
    `
    )
    .join('');
}

function renderHistory(history) {
  const labels = history.temperature.map((p) => formatTimestampLabel(p.timestamp));
  if (roomHistoryChart) roomHistoryChart.destroy();
  roomHistoryChart = new Chart(document.getElementById('roomHistoryChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: tr('temperature'),
          data: history.temperature.map((p) => (p.value === null || p.value === undefined ? null : Number(p.value))),
          borderColor: '#0e7c74',
          pointRadius: 0,
          tension: 0.22,
          yAxisID: 'y',
        },
        {
          label: tr('humidity'),
          data: history.relativeHumidity.map((p) => (p.value === null || p.value === undefined ? null : Number(p.value))),
          borderColor: '#3d9ecf',
          pointRadius: 0,
          tension: 0.22,
          yAxisID: 'y',
        },
        {
          label: tr('co2'),
          data: history.co2.map((p) => (p.value === null || p.value === undefined ? null : Number(p.value))),
          borderColor: '#d27d3f',
          pointRadius: 0,
          tension: 0.22,
          yAxisID: 'yCo2',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { type: 'linear', display: true, position: 'left' },
        yCo2: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } },
      },
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

async function loadRoomView() {
  const roomId = roomIdFromPath();
  const [room, envCurrent, artworks, history] = await Promise.all([
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}`),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/environment/current`),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/artworks`),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/history?range=24h`),
  ]);

  document.getElementById('roomName').textContent = room.name;
  document.getElementById('roomMeta').textContent = `${room.area} m2 · cap ${room.capacity}`;
  document.getElementById('roomStatus').innerHTML = statusBadge(room.status);

  renderRadar({ ...envCurrent.environment, ...envCurrent.noise }, avgReq(artworks));
  renderArtworkTable(artworks);
  renderHistory(history);
}

async function refreshHistoryByRange() {
  const roomId = roomIdFromPath();
  const range = document.getElementById('roomRange').value;
  const history = await apiGet(`/api/rooms/${encodeURIComponent(roomId)}/history?range=${range}`);
  renderHistory(history);
}

async function compareSelected() {
  const checked = Array.from(document.querySelectorAll('input[data-art-id]:checked')).map((el) => el.getAttribute('data-art-id'));
  const ids = checked.slice(0, 3);
  if (!ids.length) {
    document.getElementById('compareWrap').innerHTML = `<div class="small">${tr('selectUpTo3')}</div>`;
    return;
  }

  const data = await apiGet(`/api/artworks/compare?ids=${ids.map(encodeURIComponent).join(',')}`);
  document.getElementById('compareWrap').innerHTML = data
    .map(
      (a) => `
      <article class="card">
        <img src="${a.image}" alt="${a.name}" style="width:100%;height:130px;object-fit:cover;border-radius:8px"/>
        <h4>${a.name}</h4>
        <div class="small">${a.artist || ''}</div>
        <div style="margin-top:8px">${tr('severity')}: <strong>${formatMetric(a.degradationRisk, { digits: 3, zeroAsMissing: false })}</strong></div>
        <div class="pill" style="margin-top:8px">${tr('state')}: ${a.conditionStatus || 'good'}</div>
      </article>
    `
    )
    .join('');
}

function wireActions() {
  const roomId = roomIdFromPath();

  document.getElementById('roomRange').addEventListener('change', refreshHistoryByRange);
  document.getElementById('compareBtn').addEventListener('click', compareSelected);

  document.getElementById('exportPdf').addEventListener('click', () => {
    window.open(`/api/rooms/${encodeURIComponent(roomId)}/passport?format=pdf`, '_blank');
  });
  document.getElementById('exportMd').addEventListener('click', () => {
    window.open(`/api/rooms/${encodeURIComponent(roomId)}/passport?format=md`, '_blank');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'room-artwork') return;
  wireActions();
  loadRoomView().catch((err) => console.error(err));
  ensureSocket().on('update', () => loadRoomView());
});
