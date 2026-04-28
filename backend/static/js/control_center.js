let alertsChart;

function alertFilters() {
  const center = document.getElementById('alertFilterCenter');
  const type = document.getElementById('alertFilterType');
  const severity = document.getElementById('alertFilterSeverity');
  const status = document.getElementById('alertFilterStatus');
  return {
    center: center ? center.value : '',
    type: type ? type.value : '',
    severity: severity ? severity.value : '',
    status: status ? status.value : '',
  };
}

function badgeForState(state) {
  if (state === 'off') return '<span class="badge attention">off</span>';
  if (state === 'fault') return '<span class="badge critical">fault</span>';
  if (state === 'maintenance') return '<span class="badge attention">maintenance</span>';
  return '<span class="badge optimal">on</span>';
}

function deviceBatteryBar(level) {
  const safe = Number.isFinite(Number(level)) ? Math.max(0, Math.min(100, Number(level))) : 0;
  const color = safe < 25 ? 'var(--danger)' : safe < 50 ? 'var(--warn)' : 'var(--ok)';
  return `<div class="meter"><span style="width:${safe}%;background:${color}"></span></div>`;
}

function setTab(tab) {
  document.querySelectorAll('[data-tab]').forEach((el) => {
    el.style.display = el.getAttribute('data-tab') === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('btn-primary', btn.getAttribute('data-target') === tab);
  });
}

async function loadAlertsTab() {
  const filters = alertFilters();
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key === 'center' ? 'center' : key, value);
  });
  const [alerts, stats] = await Promise.all([
    apiGet(`/api/admin/alerts${params.toString() ? `?${params.toString()}` : ''}`),
    apiGet('/api/admin/alerts/stats'),
  ]);

  const centerFilter = document.getElementById('alertFilterCenter');
  if (centerFilter) {
    const centers = [...new Map(alerts.map((a) => [a.centerCode || a.centerName, a.centerName])).entries()]
      .filter(([code]) => code)
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    centerFilter.innerHTML = `<option value="">${tr('allCenters')}</option>${centers
      .map(([code, name]) => `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`)
      .join('')}`;
    if (filters.center) centerFilter.value = filters.center;
  }

  document.getElementById('alertsTableBody').innerHTML = alerts
    .length
    ? alerts
        .map(
          (a) => `
      <tr>
        <td>${escapeHtml(a.centerName || a.centerCode || '—')}</td>
        <td>${escapeHtml(a.subCategory || '—')}</td>
        <td><span class="badge ${a.severity === 'critical' ? 'critical' : a.severity === 'high' ? 'attention' : 'optimal'}">${escapeHtml(a.severity || '—')}</span></td>
        <td>${escapeHtml(a.status || '—')}</td>
        <td>${escapeHtml(a.roomName || a.alertSource || '—')}</td>
        <td>${escapeHtml(a.dateIssued || a.dateModified || '—')}</td>
        <td><button class="btn" data-resolve="${escapeHtml(a.id)}">${tr('resolve')}</button></td>
      </tr>
    `,
        )
        .join('')
    : `<tr><td colspan="7"><div class="small">${tr('noAlerts')}</div></td></tr>`;

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
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

async function loadDevicesTab() {
  const devices = await apiGet('/api/admin/devices');
  const body = document.getElementById('devicesTableBody');
  body.innerHTML = devices.length
    ? devices
        .map(
          (d) => `
      <tr>
        <td>${escapeHtml(d.name || d.id)}</td>
        <td>${escapeHtml(d.roomName || '—')}</td>
        <td>${escapeHtml(d.deviceCategory || d.category || '—')}</td>
        <td>${badgeForState(d.deviceState)}</td>
        <td>${deviceBatteryBar(Math.round(Number(d.batteryLevel || 0) * 100))}</td>
        <td>${escapeHtml(d.lastReading || d.dateModified || '—')}</td>
      </tr>
    `,
        )
        .join('')
    : `<tr><td colspan="6"><div class="small">${tr('noDevices')}</div></td></tr>`;
}

async function loadGrafanaTab() {
  const g = await apiGet('/api/grafana/admin');
  const frame = document.getElementById('adminGrafana');
  const link = document.getElementById('adminGrafanaLink');
  frame.src = g.embed;
  if (link) {
    link.href = g.url;
    link.textContent = tr('directLink');
  }
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

  ['alertFilterCenter', 'alertFilterType', 'alertFilterSeverity', 'alertFilterStatus'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => loadAlertsTab().catch((err) => console.error(err)));
    }
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
