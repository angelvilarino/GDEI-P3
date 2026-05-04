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
    // Update only the dynamic metric values and sparklines without full re-render
    // to avoid flickering. Re-render is safe since filters are re-applied.
    renderCenters();
    await renderSparklines();
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

  // avgOccupancy is a 0-1 ratio; multiply by 100 to show as percentage
  const grid = document.getElementById('centersGrid');
  grid.innerHTML = data.length
    ? data
        .map(
          (c) => {
            const occupancyPct = c.snapshot.avgOccupancy != null
              ? `${(c.snapshot.avgOccupancy * 100).toFixed(0)} %`
              : '—';
            return `
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
          <div>${tr('occupancy')}: <strong>${occupancyPct}</strong></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px">
          <div class="chart-wrap" style="flex:1;height:140px">
            <div class="small">${tr('temperature')}</div>
            <canvas id="spark-temp-${c.code}"></canvas>
          </div>
          <div class="chart-wrap" style="flex:1;height:140px">
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
  // Destroy previous charts before re-creating
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

      const tempLabels = tempSeries.map((p) => formatTimestampLabel(p.timestamp));
      const occLabels = peopleSeries.length
        ? peopleSeries.map((p) => formatTimestampLabel(p.timestamp))
        : tempLabels;

      // Temperature chart – own Y axis, own scale
      const chartTemp = new Chart(ctxTemp, {
        type: 'line',
        data: {
          labels: tempLabels,
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
          scales: {
            x: { display: false },
            y: {
              display: true,
              title: { display: true, text: '°C', font: { size: 10 } },
            }
          }
        }
      });

      // Occupancy chart (people count) – own Y axis, own scale, independent of temperature
      const chartOcc = new Chart(ctxOcc, {
        type: 'line',
        data: {
          labels: occLabels,
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
                  return `${context.dataset.label}: ${Math.round(context.parsed.y)} personas`;
                },
              },
            }
          },
          scales: {
            x: { display: false },
            y: {
              display: true,
              title: { display: true, text: 'pers.', font: { size: 10 } },
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

  // Periodic refresh every 15 seconds
  refreshIntervalId = setInterval(() => {
    refreshCenters().catch((err) => console.warn('[centers] Auto-refresh error:', err));
  }, 15000);

  // Also refresh on SocketIO update events
  ensureSocket().on('update', () => refreshCenters());
});
