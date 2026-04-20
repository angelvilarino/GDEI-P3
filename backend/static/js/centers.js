let centersCache = [];

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

function renderCenters() {
  const typeFilter = document.getElementById('filterType').value;
  const statusFilter = document.getElementById('filterStatus').value;
  const occFilter = document.getElementById('filterOccupancy').value;

  const data = centersCache.filter((c) => {
    if (typeFilter && !c.type.includes(typeFilter)) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (occFilter && occupancyBucket(c.snapshot.avgOccupancy) !== occFilter) return false;
    return true;
  });

  const grid = document.getElementById('centersGrid');
  grid.innerHTML = data
    .map(
      (c) => `
      <article class="card fade-up" id="card-${c.code}">
        <img src="${c.image}" alt="${c.name}" style="width:100%;height:180px;object-fit:cover;border-radius:10px"/>
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:8px">
          <h3 style="margin:0">${c.name}</h3>
          ${statusBadge(c.status)}
        </div>
        <p class="small">${c.type}</p>
        <div class="grid grid-2">
          <div>${tr('temperature')}: <strong>${formatNumber(c.snapshot.avgTemperature)} C</strong></div>
          <div>${tr('humidity')}: <strong>${formatNumber(c.snapshot.avgHumidity)}%</strong></div>
          <div>${tr('co2')}: <strong>${formatNumber(c.snapshot.avgCo2, 0)} ppm</strong></div>
          <div>${tr('occupancy')}: <strong>${Math.round(c.snapshot.avgOccupancy * 100)}%</strong></div>
        </div>
        <div class="chart-wrap" style="margin-top:10px;height:130px"><canvas id="spark-${c.code}"></canvas></div>
        <div style="display:flex;justify-content:flex-end;margin-top:10px">
          <a class="btn btn-primary" href="/center/${c.code}">Ver detalle</a>
        </div>
      </article>
    `
    )
    .join('');
}

async function renderSparklines() {
  const jobs = centersCache.map(async (c) => {
    try {
      const trend = await apiGet(`/api/centers/${c.code}/trend?range=1h`);
      const temp = trend.temperature.slice(-20).map((p) => Number(p.value || 0));
      const labels = temp.map((_, idx) => idx + 1);
      const ctx = document.getElementById(`spark-${c.code}`);
      if (!ctx) return;
      new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              data: temp,
              borderColor: '#0e7c74',
              backgroundColor: '#0e7c741a',
              borderWidth: 2,
              fill: true,
              pointRadius: 0,
              tension: 0.25,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { display: false }, y: { display: false } },
        },
      });
    } catch (err) {
      console.error(err);
    }
  });
  await Promise.all(jobs);
}

function wireFilters() {
  ['filterType', 'filterStatus', 'filterOccupancy'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => {
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
