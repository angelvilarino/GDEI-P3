let centersCache = [];
const sparklineCharts = new Map();

function occupancyBucket(v) {
  if (v < 0.35) return 'free';
  if (v <= 0.7) return 'moderate';
  return 'congested';
}

async function loadCenters() {
  centersCache = await apiGet('/api/centers');
  renderCenters();
  await renderSparklines();
}

function currentFilters() {
  return {
    type: document.getElementById('filterType').value,
    status: document.getElementById('filterStatus').value,
    occupancy: document.getElementById('filterOccupancy').value,
    search: document.getElementById('filterSearch').value.trim().toLowerCase(),
  };
}

function renderCenters() {
  const { type, status, occupancy, search } = currentFilters();

  const data = centersCache.filter((c) => {
    if (type && !c.type.includes(type)) return false;
    if (status && c.status !== status) return false;
    if (occupancy && occupancyBucket(c.snapshot.avgOccupancy ?? 0) !== occupancy) return false;
    if (search) {
      const haystack = [c.name, c.type, c.status, c.code].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const grid = document.getElementById('centersGrid');
  grid.innerHTML = data.length
    ? data
        .map(
          (c) => `
      <article class="card fade-up center-card" id="card-${c.code}">
        <img class="center-card-image" src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" />
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:8px">
          <h3 style="margin:0">${escapeHtml(c.name)}</h3>
          ${statusBadge(c.status)}
        </div>
        <p class="small">${escapeHtml(c.type)}</p>
        <div class="grid grid-2">
          <div>${tr('temperature')}: <strong>${formatMetric(c.snapshot.avgTemperature, { unit: '°C' })}</strong></div>
          <div>${tr('humidity')}: <strong>${formatMetric(c.snapshot.avgHumidity, { unit: '%' })}</strong></div>
          <div>${tr('co2')}: <strong>${formatMetric(c.snapshot.avgCo2, { digits: 0, unit: 'ppm' })}</strong></div>
          <div>${tr('occupancy')}: <strong>${formatMetric(c.snapshot.avgOccupancy, { digits: 0, unit: '%', zeroAsMissing: false })}</strong></div>
        </div>
        <div class="chart-wrap" style="margin-top:10px;height:140px">
          <div class="small">${tr('temperature')}</div>
          <canvas id="spark-temp-${c.code}"></canvas>
        </div>
        <div class="chart-wrap" style="margin-top:8px;height:140px">
          <div class="small">${tr('occupancy')}</div>
          <canvas id="spark-occ-${c.code}"></canvas>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:10px">
          <a class="btn btn-primary" href="/centers/${c.code}">${tr('viewDetail')}</a>
        </div>
      </article>
    `
        )
        .join('')
    : `<div class="card"><div class="small">${tr('noDataAvailable')}</div></div>`;
}

async function renderSparklines() {
  sparklineCharts.forEach((chart) => chart.destroy());
  sparklineCharts.clear();

  const jobs = centersCache.map(async (c) => {
    try {
      const trend = await apiGet(`/api/centers/${c.code}/trend?range=1h`);
      const ctxTemp = document.getElementById(`spark-temp-${c.code}`);
      const ctxOcc = document.getElementById(`spark-occ-${c.code}`);
      if (!ctxTemp || !ctxOcc) return;

      const tempSeries = (trend.temperature || []).slice(-20);
      const peopleSeries = (trend.peopleCount || []).slice(-20);
      
      if (!tempSeries.length && !peopleSeries.length) {
        ctxTemp.parentElement.innerHTML = `<div class="empty-state">${tr('noDataAvailable')}</div>`;
        ctxOcc.parentElement.innerHTML = `<div class="empty-state">${tr('noDataAvailable')}</div>`;
        return;
      }

      const labels = (tempSeries.length ? tempSeries : peopleSeries).map((p) => formatTimestampLabel(p.timestamp));

      // Gráfica de Temperatura
      const chartTemp = new Chart(ctxTemp, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: tr('temperatureWithUnit'),
            data: tempSeries.map(p => p.value),
            borderColor: '#0e7c74',
            backgroundColor: '#0e7c741a',
            borderWidth: 2,
            fill: true,
            pointRadius: 0,
            tension: 0.25,
            unit: '°C'
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
                    const unit = context.dataset.unit || '';
                    return `${context.dataset.label}: ${formatMetric(context.parsed.y, { digits: 1, unit, zeroAsMissing: false })}`;
                  },
                },
            }
          },
          scales: { x: { display: false }, y: { display: true } }
        }
      });

      // Gráfica de Aforo
      const chartOcc = new Chart(ctxOcc, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: tr('occupancyWithUnit'),
            data: peopleSeries.map(p => p.value),
            borderColor: '#d27d3f',
            backgroundColor: '#d27d3f1a',
            borderWidth: 2,
            fill: true,
            pointRadius: 0,
            tension: 0.25,
            unit: tr('occupancy')
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
                    const unit = context.dataset.unit || '';
                    return `${context.dataset.label}: ${formatMetric(context.parsed.y, { digits: 1, unit, zeroAsMissing: false })}`;
                  },
                },
            }
          },
          scales: { x: { display: true }, y: { display: true } }
        }
      });

      sparklineCharts.set(`${c.code}-temp`, chartTemp);
      sparklineCharts.set(`${c.code}-occ`, chartOcc);
    } catch (err) {
      console.error(err);
    }
  });
  await Promise.all(jobs);
}

function wireFilters() {
  ['filterType', 'filterStatus', 'filterOccupancy', 'filterSearch'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => {
      renderCenters();
      renderSparklines();
    });
    document.getElementById(id).addEventListener('input', () => {
      renderCenters();
      renderSparklines();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'centers') return;
  wireFilters();
  loadCenters().catch((err) => console.error(err));
  ensureSocket().on('update', () => loadCenters());
});
