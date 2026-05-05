let radarChart;
let tempChart, humidityChart, co2Chart, noiseChart;
let currentRange = '24h';
let currentCenter = null;
let currentArtworks = [];

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

function getRiskLevel(risk) {
  if (risk < 0.25) return 'low';
  if (risk < 0.5) return 'medium';
  if (risk < 0.75) return 'high';
  return 'critical';
}

function statusBadge(status) {
  const classes = {
    ok: 'ok',
    warn: 'warn',
    danger: 'danger',
    critical: 'danger'
  };
  const labels = {
    ok: 'Buen Estado',
    warn: 'Advertencia',
    danger: 'Crítico',
    critical: 'Crítico'
  };
  return `<span class="status-badge ${classes[status] || 'ok'}">${labels[status] || 'Desconocido'}</span>`;
}

function renderRadar(current, optimal) {
  const labels = ['Temperatura', 'Humedad', 'CO₂', 'Iluminancia', 'Ruido'];
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
          backgroundColor: '#0e7c7430',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#0e7c74',
        },
        {
          label: 'Óptimo',
          data: oVals,
          borderColor: '#d27d3f',
          backgroundColor: '#d27d3f28',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#d27d3f',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { r: { beginAtZero: true } },
      plugins: {
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 },
          displayColors: true,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + context.parsed.r.toFixed(2);
            }
          }
        },
        legend: { position: 'bottom' }
      },
    },
  });
}

function renderGallery(artworks) {
  const gallery = document.getElementById('artworksGallery');
  gallery.innerHTML = artworks.map(a => `
    <div class="gallery-item" data-art-id="${a.id}" data-art-name="${a.name}" data-art-artist="${a.artist || ''}" data-art-image="${a.image}">
      <img src="${a.image}" alt="${a.name}"/>
      <div class="artwork-title">${a.name.substring(0, 20)}${a.name.length > 20 ? '...' : ''}</div>
    </div>
  `).join('');

  // Event listeners para zoom
  document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const overlay = document.getElementById('artworkZoomOverlay');
      const img = document.getElementById('zoomImage');
      const info = document.getElementById('zoomInfo');
      
      img.src = item.dataset.artImage;
      img.alt = item.dataset.artName;
      
      const artwork = artworks.find(a => a.id === item.dataset.artId);
      info.innerHTML = `
        <div class="zoom-info-item">
          <span class="zoom-info-label">Título</span>
          <span class="zoom-info-value">${artwork.name}</span>
        </div>
        <div class="zoom-info-item">
          <span class="zoom-info-label">Artista</span>
          <span class="zoom-info-value">${artwork.artist || 'Desconocido'}</span>
        </div>
        <div class="zoom-info-item">
          <span class="zoom-info-label">Material</span>
          <span class="zoom-info-value">${artwork.material || '-'}</span>
        </div>
        <div class="zoom-info-item">
          <span class="zoom-info-label">Año</span>
          <span class="zoom-info-value">${artwork.year || '-'}</span>
        </div>
        <div class="zoom-info-item">
          <span class="zoom-info-label">Riesgo</span>
          <span class="zoom-info-value">${(artwork.degradationRisk || 0).toFixed(3)}</span>
        </div>
      `;
      
      overlay.style.display = 'flex';
    });
  });
}

function renderArtworkTable(artworks) {
  currentArtworks = artworks;
  const tbody = document.getElementById('artworksTableBody');
  tbody.innerHTML = artworks.map(a => {
    const risk = Number(a.degradationRisk || 0);
    const riskLevel = getRiskLevel(risk);
    return `
      <tr>
        <td><input type="checkbox" data-art-id="${a.id}"/></td>
        <td><img src="${a.image}" alt="${a.name}"/></td>
        <td>${a.name}</td>
        <td>${a.artist || '-'}</td>
        <td>${a.material || '-'}</td>
        <td>
          <div class="risk-bar">
            <div class="risk-progress">
              <div class="risk-progress-fill ${riskLevel}" style="width: ${Math.min(risk * 100, 100)}%"></div>
            </div>
            <span class="risk-value">${risk.toFixed(3)}</span>
          </div>
        </td>
        <td>${formatMetric(a.stressAccumulated || 0, { digits: 2 })}</td>
        <td>${a.conditionStatus || 'Buena'}</td>
      </tr>
    `;
  }).join('');
}

function renderIndividualCharts(history) {
  const labels = history.temperature?.map(p => p.timestamp) || [];

  // Tooltip callback mejorado sin retardo
  const tooltipConfig = {
    enabled: true,
    animation: false,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    titleFont: { size: 13, weight: 'bold' },
    bodyFont: { size: 12 },
    displayColors: true,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    callbacks: {
      title(context) {
        const ts = context[0].label;
        try {
          const d = new Date(ts);
          return d.toLocaleString('es-ES', { 
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          });
        } catch (e) {
          return ts;
        }
      },
      label(context) {
        return context.dataset.label + ': ' + (context.parsed.y !== null ? context.parsed.y.toFixed(2) : 'N/A');
      }
    }
  };

  // Temperature Chart
  if (tempChart) tempChart.destroy();
  tempChart = new Chart(document.getElementById('tempChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Temperatura (°C)',
        data: history.temperature?.map(p => p.value) || [],
        borderColor: '#0e7c74',
        backgroundColor: '#0e7c7410',
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#0e7c74',
        tension: 0.22,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: { 
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          grid: { display: false }
        },
        y: { beginAtZero: false, grid: { drawBorder: false } }
      },
      plugins: { 
        legend: { display: false },
        tooltip: tooltipConfig
      }
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
        data: history.relativeHumidity?.map(p => p.value) || [],
        borderColor: '#3d9ecf',
        backgroundColor: '#3d9ecf10',
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#3d9ecf',
        tension: 0.22,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: { 
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          grid: { display: false }
        },
        y: { beginAtZero: false, grid: { drawBorder: false } }
      },
      plugins: { 
        legend: { display: false },
        tooltip: tooltipConfig
      }
    },
  });

  // CO2 Chart
  if (co2Chart) co2Chart.destroy();
  co2Chart = new Chart(document.getElementById('co2Chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'CO₂ (ppm)',
        data: history.co2?.map(p => p.value) || [],
        borderColor: '#d27d3f',
        backgroundColor: '#d27d3f10',
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#d27d3f',
        tension: 0.22,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: { 
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          grid: { display: false }
        },
        y: { beginAtZero: false, grid: { drawBorder: false } }
      },
      plugins: { 
        legend: { display: false },
        tooltip: tooltipConfig
      }
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
        data: history.LAeq?.map(p => p.value) || [],
        borderColor: '#a86b18',
        backgroundColor: '#a86b1810',
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#a86b18',
        tension: 0.22,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: { 
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          grid: { display: false }
        },
        y: { beginAtZero: false, grid: { drawBorder: false } }
      },
      plugins: { 
        legend: { display: false },
        tooltip: tooltipConfig
      }
    },
  });
}

async function loadRoomView() {
  const roomId = roomIdFromPath();
  const [room, center, envCurrent, artworks, history] = await Promise.all([
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}`),
    apiGet(`/api/centers/${encodeURIComponent(room?.id?.split(':')[2]?.split('-')[0] || 'muncyt')}`),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/environment/current`),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/artworks`),
    apiGet(`/api/rooms/${encodeURIComponent(roomId)}/history?range=${currentRange}`),
  ]).catch(() => []);

  if (!room) return;

  currentCenter = center;

  // Hero Card
  document.getElementById('roomName').textContent = room.name;
  document.getElementById('roomStatus').innerHTML = statusBadge(room.status);
  document.getElementById('roomArea').textContent = `${room.area} m²`;
  document.getElementById('roomCapacity').textContent = `${room.capacity} personas`;
  
  // Mini-dashboard ambiental
  if (envCurrent?.environment) {
    document.getElementById('roomTemp').textContent = (envCurrent.environment.temperature || '--') + '°C';
    document.getElementById('roomHumidity').textContent = (envCurrent.environment.relativeHumidity || '--') + '%';
  }

  // Radar
  renderRadar({ ...envCurrent?.environment, ...envCurrent?.noise }, avgReq(artworks || []));

  // Mostrar/ocultar sección de obras según tipo de museo
  const artworksSection = document.getElementById('artworksSection');
  const isMuseum = center?.museumType?.includes('museum');
  if (isMuseum && artworks?.length > 0) {
    artworksSection.style.display = 'block';
    renderGallery(artworks);
    renderArtworkTable(artworks);
  } else {
    artworksSection.style.display = 'none';
  }

  // Gráficas
  renderIndividualCharts(history || {});
}

async function changeRange(range) {
  currentRange = range;
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
      <img src="${a.image}" alt="${a.name}" style="width:100%;height:150px;object-fit:cover;border-radius:8px"/>
      <h4>${a.name}</h4>
      <div class="small">${a.artist || ''}</div>
      <div style="margin-top:12px">
        <div style="font-size: 0.9rem; margin-bottom: 4px;">
          <strong>Riesgo:</strong> ${(a.degradationRisk || 0).toFixed(3)}
        </div>
        <div style="font-size: 0.9rem;">
          <strong>Estado:</strong> ${a.conditionStatus || 'Buena'}
        </div>
      </div>
    </article>
  `).join('');
  modal.style.display = 'flex';
}

function wireActions() {
  // Dropdown de rango
  document.getElementById('historicalRange').addEventListener('change', (e) => {
    changeRange(e.target.value);
  });

  // Botón comparar
  document.getElementById('compareBtn').addEventListener('click', compareSelected);

  // Select All checkbox
  document.getElementById('selectAll').addEventListener('change', (e) => {
    document.querySelectorAll('input[data-art-id]').forEach(cb => cb.checked = e.target.checked);
  });

  // Modal close
  const modal = document.getElementById('compareModal');
  document.querySelector('.close').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Zoom close
  const zoomOverlay = document.getElementById('artworkZoomOverlay');
  document.querySelector('.zoom-close').addEventListener('click', () => {
    zoomOverlay.style.display = 'none';
  });

  zoomOverlay.addEventListener('click', (e) => {
    if (e.target === zoomOverlay) {
      zoomOverlay.style.display = 'none';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'room-artwork') return;
  wireActions();
  loadRoomView().catch(err => console.error(err));
  ensureSocket().on('update', () => loadRoomView());
});
