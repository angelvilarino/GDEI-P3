let alertsChart;

function setTab(tab) {
  document.querySelectorAll('[data-tab]').forEach((el) => {
    el.style.display = el.getAttribute('data-tab') === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('btn-primary', btn.getAttribute('data-target') === tab);
  });
}

async function loadAlertsTab() {
  const [alerts, stats] = await Promise.all([
    apiGet('/api/admin/alerts'),
    apiGet('/api/admin/alerts/stats'),
  ]);

  document.getElementById('alertsTableBody').innerHTML = alerts
    .map(
      (a) => `
      <tr>
        <td>${a.subCategory || '-'}</td>
        <td>${a.severity || '-'}</td>
        <td>${a.status || '-'}</td>
        <td>${a.alertSource || '-'}</td>
        <td>${a.dateIssued || '-'}</td>
        <td><button class="btn" data-resolve="${a.id}">${tr('resolve')}</button></td>
      </tr>
    `
    )
    .join('');

  document.querySelectorAll('button[data-resolve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await apiSend(`/api/alerts/${encodeURIComponent(btn.getAttribute('data-resolve'))}/resolve`, 'PATCH');
      await loadAlertsTab();
    });
  });

  const labels = Object.keys(stats.byType || {});
  const values = Object.values(stats.byType || {});
  if (alertsChart) alertsChart.destroy();
  alertsChart = new Chart(document.getElementById('alertsStatsChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: tr('alerts'),
        data: values,
        backgroundColor: '#d27d3f88',
        borderColor: '#d27d3f',
        borderWidth: 1,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

async function loadDevicesTab() {
  const devices = await apiGet('/api/admin/devices');
  const body = document.getElementById('devicesTableBody');
  body.innerHTML = devices
    .map(
      (d) => `
      <tr>
        <td>${d.name || d.id}</td>
        <td>${d.deviceState || '-'}</td>
        <td>${Math.round(Number(d.batteryLevel || 0) * 100)}%</td>
        <td>${formatNumber(d.latencyMs || 0, 1)} ms</td>
        <td>${formatNumber(d.prediction?.probability || 0, 3)}</td>
        <td>${d.maintenanceBadge ? '<span class="badge attention">Mantenimiento proximo</span>' : '<span class="badge optimal">OK</span>'}</td>
      </tr>
    `
    )
    .join('');
}

async function loadGrafanaTab() {
  const g = await apiGet('/api/grafana/admin');
  document.getElementById('adminGrafana').src = g.embed;
}

function wireTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const target = btn.getAttribute('data-target');
      setTab(target);
      if (target === 'alerts') await loadAlertsTab();
      if (target === 'devices') await loadDevicesTab();
      if (target === 'grafana') await loadGrafanaTab();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'control-center') return;
  wireTabs();
  setTab('alerts');
  loadAlertsTab().catch((err) => console.error(err));
  ensureSocket().on('alerts', () => loadAlertsTab());
  ensureSocket().on('devices', () => loadDevicesTab());
});
