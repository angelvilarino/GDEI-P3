let alertsChart;

// Preserve current filter values across re-renders
let _alertFilterState = { center: '', type: '', severity: '', status: '' };

function alertFilters() {
  return { ..._alertFilterState };
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

/**
 * Populate a <select> element with dynamic options from a Set of values.
 * The first option is always "Todos" with value="".
 * The current value is restored after re-render.
 *
 * @param {HTMLSelectElement} select
 * @param {string[]} values - unique option values
 * @param {string} allLabel - i18n key for the "all" option
 * @param {string} currentValue - value to restore after rebuild
 */
function populateSelect(select, values, allLabel, currentValue) {
  if (!select) return;
  const sorted = [...values].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)));
  select.innerHTML =
    `<option value="">${tr(allLabel)}</option>` +
    sorted.map((v) => `<option value="${escapeHtml(v)}"${v === currentValue ? ' selected' : ''}>${escapeHtml(v)}</option>`).join('');
}

async function loadAlertsTab() {
  const filters = alertFilters();
  const params = new URLSearchParams();
  if (filters.center)   params.set('center',   filters.center);
  if (filters.type)     params.set('type',      filters.type);
  if (filters.severity) params.set('severity',  filters.severity);
  if (filters.status)   params.set('status',    filters.status);

  // Fetch filtered alerts (for table + dynamic filter options)
  const qs = params.toString();
  const alerts = await apiGet(`/api/admin/alerts${qs ? `?${qs}` : ''}`);

  // Fetch stats WITH the same active filters so the chart reflects the filtered view
  const statsUrl = `/api/admin/alerts/stats${qs ? `?${qs}` : ''}`;
  const stats = await apiGet(statsUrl);

  // --- Populate center filter from current alerts ---
  const centerFilter = document.getElementById('alertFilterCenter');
  if (centerFilter) {
    const centers = [...new Map(alerts.map((a) => [a.centerCode || a.centerName, a.centerName])).entries()]
      .filter(([code]) => code)
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    centerFilter.innerHTML =
      `<option value="">${tr('allCenters')}</option>` +
      centers.map(([code, name]) =>
        `<option value="${escapeHtml(code)}"${code === filters.center ? ' selected' : ''}>${escapeHtml(name)}</option>`
      ).join('');
  }

  // --- Populate type / severity / status from unique values in current dataset ---
  const typeFilter     = document.getElementById('alertFilterType');
  const severityFilter = document.getElementById('alertFilterSeverity');
  const statusFilter   = document.getElementById('alertFilterStatus');

  populateSelect(
    typeFilter,
    [...new Set(alerts.map((a) => a.subCategory || a.type).filter(Boolean))],
    'allTypes',
    filters.type
  );

  populateSelect(
    severityFilter,
    [...new Set(alerts.map((a) => a.severity).filter(Boolean))],
    'allSeverity',
    filters.severity
  );

  populateSelect(
    statusFilter,
    [...new Set(alerts.map((a) => a.status).filter(Boolean))],
    'allState',
    filters.status
  );

  // --- Render alerts table ---
  const tbody = document.getElementById('alertsTableBody');
  tbody.innerHTML = alerts.length
    ? alerts.map((a) => `
      <tr data-alert-id="${escapeHtml(a.id)}">
        <td>${escapeHtml(a.centerName || a.centerCode || '—')}</td>
        <td>${escapeHtml(a.subCategory || '—')}</td>
        <td><span class="badge ${a.severity === 'critical' ? 'critical' : a.severity === 'high' ? 'attention' : 'optimal'}">${escapeHtml(a.severity || '—')}</span></td>
        <td>${escapeHtml(a.status || '—')}</td>
        <td>${escapeHtml(a.roomName || a.alertSource || '—')}</td>
        <td>${escapeHtml(a.dateIssued || a.dateModified || '—')}</td>
        <td><button class="btn" data-resolve-id="${escapeHtml(a.id)}">${tr('resolve')}</button></td>
      </tr>
    `).join('')
    : `<tr><td colspan="7"><div class="small">${tr('noAlerts')}</div></td></tr>`;

  // Wire resolve buttons — animate out row, don't reload full table
  tbody.querySelectorAll('button[data-resolve-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-resolve-id');
      await apiSend(`/api/alerts/${encodeURIComponent(id)}/resolve`, 'PATCH');
      removeControlAlertRow(id);
    });
  });

  // --- Render chart with filtered stats ---
  renderAlertsChart(stats);
}

function removeControlAlertRow(alertId) {
  const row = document.querySelector(`#alertsTableBody tr[data-alert-id="${CSS.escape(alertId)}"]`);
  if (!row) return;
  row.classList.add('resolving');
  row.addEventListener('animationend', () => row.remove(), { once: true });
}

function renderAlertsChart(stats) {
  const labels = Object.keys(stats.byType || {});
  const unresolvedData = labels.map((type) => (stats.byType[type]?.unresolved || 0));
  const resolvedData   = labels.map((type) => (stats.byType[type]?.resolved   || 0));

  if (alertsChart) alertsChart.destroy();
  alertsChart = new Chart(document.getElementById('alertsStatsChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: tr('unresolved') || 'Sin resolver',
          data: unresolvedData,
          backgroundColor: '#e74c3c',
          borderColor: '#c0392b',
          borderWidth: 1,
          stack: 'stack-alerts',
        },
        {
          label: tr('resolved') || 'Resueltas',
          data: resolvedData,
          backgroundColor: '#2ecc71',
          borderColor: '#27ae60',
          borderWidth: 1,
          stack: 'stack-alerts',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { stacked: true },
        y: { stacked: true },
      },
    },
  });
}

async function loadDevicesTab() {
  const devices = await apiGet('/api/admin/devices');

  // Initialize device filters
  const centerFilter     = document.getElementById('deviceFilterCenter');
  const roomFilter       = document.getElementById('deviceFilterRoom');
  const typeFilter       = document.getElementById('deviceFilterType');
  const stateFilter      = document.getElementById('deviceFilterState');
  const lowBatteryCheckbox = document.getElementById('deviceFilterLowBattery');
  const groupToggleBtn   = document.getElementById('deviceGroupToggle');

  // Populate center filter
  if (centerFilter) {
    const centers = [...new Set(devices.map((d) => d.centerCode).filter(Boolean))].sort();
    centerFilter.innerHTML =
      `<option value="">${tr('allCenters')}</option>` +
      centers.map((code) => `<option value="${escapeHtml(code)}">${escapeHtml(code)}</option>`).join('');
    centerFilter.addEventListener('change', () => filterAndRenderDevices(devices));
  }

  // Populate type filter
  if (typeFilter) {
    const types = [...new Set(devices.map((d) => d.deviceCategory || d.category).filter(Boolean))].sort();
    typeFilter.innerHTML =
      `<option value="">${tr('allTypes')}</option>` +
      types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('');
    typeFilter.addEventListener('change', () => filterAndRenderDevices(devices));
  }

  // Populate state filter
  if (stateFilter) {
    const states = [...new Set(devices.map((d) => d.deviceState).filter(Boolean))].sort();
    stateFilter.innerHTML =
      `<option value="">${tr('allState')}</option>` +
      states.map((st) => `<option value="${escapeHtml(st)}">${escapeHtml(st)}</option>`).join('');
    stateFilter.addEventListener('change', () => filterAndRenderDevices(devices));
  }

  // Low battery checkbox
  if (lowBatteryCheckbox) {
    lowBatteryCheckbox.addEventListener('change', () => filterAndRenderDevices(devices));
  }

  // Store devices globally for filtering
  window.devicesData = devices;

  // Group toggle button
  if (groupToggleBtn) {
    groupToggleBtn.addEventListener('click', () => {
      groupToggleBtn.setAttribute(
        'data-grouped',
        groupToggleBtn.getAttribute('data-grouped') === 'true' ? 'false' : 'true'
      );
      filterAndRenderDevices(devices);
    });
    groupToggleBtn.setAttribute('data-grouped', 'true');
  }

  filterAndRenderDevices(devices);
}

function filterAndRenderDevices(allDevices) {
  const centerFilter   = document.getElementById('deviceFilterCenter')?.value   || '';
  const typeFilter     = document.getElementById('deviceFilterType')?.value     || '';
  const stateFilter    = document.getElementById('deviceFilterState')?.value    || '';
  const lowBatteryCheckbox = document.getElementById('deviceFilterLowBattery')?.checked || false;
  const isGrouped      = document.getElementById('deviceGroupToggle')?.getAttribute('data-grouped') === 'true';

  let filtered = allDevices
    .filter((d) => !centerFilter || d.centerCode === centerFilter)
    .filter((d) => !typeFilter   || d.deviceCategory === typeFilter || d.category === typeFilter)
    .filter((d) => !stateFilter  || d.deviceState === stateFilter)
    .filter((d) => !lowBatteryCheckbox || (d.batteryLevel && Number(d.batteryLevel) < 0.2));

  const body = document.getElementById('devicesTableBody');

  if (isGrouped) {
    const grouped = {};
    filtered.forEach((d) => {
      const centerCode = d.centerCode || 'Unknown';
      if (!grouped[centerCode]) grouped[centerCode] = [];
      grouped[centerCode].push(d);
    });

    body.innerHTML = Object.entries(grouped)
      .map(([center, devices]) => {
        const rowsHtml = devices
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
          `
          )
          .join('');

        return `
          <tr class="group-header" style="background: var(--glass-btn); cursor: pointer;" onclick="this.nextElementSibling?.style?.display === 'none' ? this.nextElementSibling.style.display = 'table-row-group' : (this.nextElementSibling.style.display = 'none')">
            <td colspan="6"><strong>${escapeHtml(center)} (${devices.length})</strong></td>
          </tr>
          <tbody>${rowsHtml}</tbody>
        `;
      })
      .join('');
  } else {
    body.innerHTML = filtered.length
      ? filtered
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
          `
          )
          .join('')
      : `<tr><td colspan="6"><div class="small">${tr('noDevices')}</div></td></tr>`;
  }
}

async function loadGrafanaTab() {
  const g = await apiGet('/api/grafana/admin');
  const frame = document.getElementById('adminGrafana');
  const link  = document.getElementById('adminGrafanaLink');
  frame.src = g.embed;
  if (link) {
    link.href        = g.url;
    link.textContent = tr('directLink');
  }
}

function wireAlertFilters() {
  // Read filter state from DOM and persist in _alertFilterState
  const ids = ['alertFilterCenter', 'alertFilterType', 'alertFilterSeverity', 'alertFilterStatus'];
  const keys = ['center', 'type', 'severity', 'status'];

  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      _alertFilterState[keys[i]] = el.value;
      loadAlertsTab().catch((err) => console.error(err));
    });
  });
}

function wireTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const target = btn.getAttribute('data-target');
      setTab(target);
      if (target === 'alerts')  await loadAlertsTab();
      if (target === 'devices') await loadDevicesTab();
      if (target === 'grafana') await loadGrafanaTab();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'control-center') return;
  wireTabs();
  wireAlertFilters();
  setTab('alerts');
  loadAlertsTab().catch((err) => console.error(err));

  const socket = ensureSocket();
  socket.on('alerts', (data) => {
    if (data && data.action === 'resolved' && data.alertId) {
      // Remove only the affected row without reloading the whole table
      removeControlAlertRow(data.alertId);
    } else {
      loadAlertsTab().catch((err) => console.error(err));
    }
  });
  socket.on('devices', () => loadDevicesTab());
});
