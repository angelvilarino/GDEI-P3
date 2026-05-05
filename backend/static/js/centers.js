let centersCache = [];
const sparklineCharts = new Map();
let refreshIntervalId = null;

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

async function refreshCenters() {
  try {
    const fresh = await apiGet('/api/centers');
    centersCache = fresh;
    
    fresh.forEach(c => {
      const card = document.getElementById(`card-${c.code}`);
      if (!card) return;
      
      const metrics = card.querySelectorAll('.metric-value');
      if (metrics.length >= 4) {
        metrics[0].textContent = formatMetric(c.snapshot.avgTemperature, { unit: '°C' });
        metrics[1].textContent = formatMetric(c.snapshot.avgHumidity, { unit: '%' });
        metrics[2].textContent = formatMetric(c.snapshot.avgCo2, { digits: 0, unit: 'ppm' });
        // Discrete occupancy percentage
        metrics[3].textContent = c.snapshot.avgOccupancy != null
          ? `${Math.round(c.snapshot.avgOccupancy * 100)} %`
          : '—';
      }
      
      const badgeWrap = card.querySelector('.badge-wrap');
      if (badgeWrap) badgeWrap.innerHTML = statusBadge(c.status);
    });
    
  } catch (err) {
    console.warn('[centers] Refresh failed:', err);
  }
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
          (c) => {
            const occupancyPct = c.snapshot.avgOccupancy != null
              ? `${Math.round(c.snapshot.avgOccupancy * 100)} %`
              : '—';
            return `
      <article class="card fade-up center-card" id="card-${c.code}">
        <img class="center-card-image" src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" />
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:8px">
          <h3 style="margin:0">${escapeHtml(c.name)}</h3>
          <div class="badge-wrap">${statusBadge(c.status)}</div>
        </div>
        <p class="small">${escapeHtml(c.type)}</p>
        <div class="grid grid-2">
          <div>${tr('temperature')}: <strong class="metric-value">${formatMetric(c.snapshot.avgTemperature, { unit: '°C' })}</strong></div>
          <div>${tr('humidity')}: <strong class="metric-value">${formatMetric(c.snapshot.avgHumidity, { unit: '%' })}</strong></div>
          <div>${tr('co2')}: <strong class="metric-value">${formatMetric(c.snapshot.avgCo2, { digits: 0, unit: 'ppm' })}</strong></div>
          <div>${tr('occupancy')}: <strong class="metric-value">${occupancyPct}</strong></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <div class="chart-wrap" style="flex:1;height:160px">
            <div class="small">${tr('temperature')}</div>
            <canvas id="spark-temp-${c.code}"></canvas>
          </div>
          <div class="chart-wrap" style="flex:1;height:160px">
            <div class="small">${tr('occupancy')}</div>
            <canvas id="spark-occ-${c.code}"></canvas>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:10px">
          <a class="btn btn-primary" href="/centers/${c.code}">${tr('viewDetail')}</a>
        </div>
      </article>
    `;
          }
        )
        .join('')
    : `<div class="card"><div class="small">${tr('noDataAvailable')}</div></div>`;
}

async function renderSparklines() {
  sparklineCharts.forEach((chart) => chart.destroy());
  sparklineCharts.clear();

  const { type, status, occupancy, search } = currentFilters();
  const visible = centersCache.filter((c) => {
    if (type && !c.type.includes(type)) return false;
    if (status && c.status !== status) return false;
    if (occupancy && occupancyBucket(c.snapshot.avgOccupancy ?? 0) !== occupancy) return false;
    if (search) {
      const haystack = [c.name, c.type, c.status, c.code].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const jobs = visible.map(async (c) => {
    try {
      const trend = await apiGet(`/api/centers/${c.code}/trend?range=6h`);
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

      const tempLabels = tempSeries.map((p) => formatTimestampLabel(p.timestamp));
      const occLabels = peopleSeries.length
        ? peopleSeries.map((p) => formatTimestampLabel(p.timestamp))
        : tempLabels;

      const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { bottom: 20 }
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              title(items) {
                const idx = items[0].dataIndex;
                const p = items[0].dataset.points[idx];
                return p ? new Date(p.timestamp).toLocaleString(AURA.lang === 'en' ? 'en-GB' : 'es-ES') : '';
              },
              label(context) {
                const unit = context.dataset.unit || '';
                const val = context.dataset.discrete ? Math.round(context.parsed.y) : context.parsed.y;
                return `${context.dataset.label}: ${formatMetric(val, { digits: context.dataset.discrete ? 0 : 1, unit, zeroAsMissing: false })}`;
              },
            },
          }
        },
        scales: {
          x: { 
            display: true,
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 4,
              font: { size: 9 }
            }
          },
          y: {
            display: true,
            title: { display: true, text: '', font: { size: 10 } },
            ticks: { font: { size: 9 } }
          }
        }
      };

      const chartTemp = new Chart(ctxTemp, {
        type: 'line',
        data: {
          labels: tempLabels,
          datasets: [{
            label: tr('temperature'),
            data: tempSeries.map(p => p.value),
            points: tempSeries,
            borderColor: '#0e7c74',
            backgroundColor: '#0e7c741a',
            borderWidth: 2,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.25,
            unit: '°C'
          }]
        },
        options: {
          ...baseOptions,
          scales: {
            ...baseOptions.scales,
            y: { ...baseOptions.scales.y, title: { ...baseOptions.scales.y.title, text: '°C' } }
          }
        }
      });

      const chartOcc = new Chart(ctxOcc, {
        type: 'line',
        data: {
          labels: occLabels,
          datasets: [{
            label: tr('occupancy'),
            data: peopleSeries.map(p => p.value),
            points: peopleSeries,
            discrete: true,
            borderColor: '#d27d3f',
            backgroundColor: '#d27d3f1a',
            borderWidth: 2,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.25,
            unit: 'pers.'
          }]
        },
        options: {
          ...baseOptions,
          scales: {
            ...baseOptions.scales,
            y: { 
              ...baseOptions.scales.y, 
              title: { ...baseOptions.scales.y.title, text: 'pers.' },
              ticks: { ...baseOptions.scales.y.ticks, stepSize: 1, precision: 0 } // Discrete axis
            }
          }
        }
      });

      sparklineCharts.set(`${c.code}-temp`, chartTemp);
      sparklineCharts.set(`${c.code}-occ`, chartOcc);
    } catch (err) {
      console.error(`[centers] Sparkline error for ${c.code}:`, err);
    }
  });
  await Promise.all(jobs);
}

function wireFilters() {
  ['filterType', 'filterStatus', 'filterOccupancy', 'filterSearch'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      renderCenters();
      renderSparklines();
    });
    el.addEventListener('input', () => {
      renderCenters();
      renderSparklines();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'centers') return;
  wireFilters();
  loadCenters().catch((err) => console.error(err));

  refreshIntervalId = setInterval(() => {
    refreshCenters().catch((err) => console.warn('[centers] Auto-refresh error:', err));
  }, 30000);

  setInterval(() => {
    renderSparklines().catch(e => console.warn('[centers] Sparkline refresh error:', e));
  }, 30000);

  ensureSocket().on('update', () => refreshCenters());
});
