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

function removeControlAlertRow(alertId) {
  const row = document.querySelector(`#alertsTableBody tr[data-alert-id="${CSS.escape(alertId)}"]`);
  if (!row) return false;
  row.classList.add('resolving');
  row.addEventListener('animationend', () => row.remove(), { once: true });
  return true;
}

function badgeForState(state) {
  const labels = { off: tr('stateOff') || 'off', fault: tr('stateFault') || 'fault', maintenance: tr('stateMaintenance') || 'maintenance', on: tr('stateOn') || 'on' };
  if (state === 'off') return `<span class="badge attention">${labels.off}</span>`;
  if (state === 'fault') return `<span class="badge critical">${labels.fault}</span>`;
  if (state === 'maintenance') return `<span class="badge attention">${labels.maintenance}</span>`;
  return `<span class="badge optimal">${labels.on}</span>`;
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

async function renderAlertsChart(stats) {
  const labels = Object.keys(stats.byType || {});
  const unresolvedData = labels.map((type) => (stats.byType[type]?.unresolved || 0));
  const resolvedData = labels.map((type) => (stats.byType[type]?.resolved || 0));

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

function populateAlertOptions(alerts, filters) {
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

  const typeFilter = document.getElementById('alertFilterType');
  if (typeFilter) {
    const types = [...new Set(alerts.map((a) => a.subCategory || a.type).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
    typeFilter.innerHTML = `<option value="">${tr('allTypes')}</option>${types
      .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)
      .join('')}`;
    if (filters.type) typeFilter.value = filters.type;
  }

  const severityFilter = document.getElementById('alertFilterSeverity');
  if (severityFilter) {
    const severities = [...new Set(alerts.map((a) => a.severity).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
    severityFilter.innerHTML = `<option value="">${tr('allSeverity')}</option>${severities
      .map((sev) => `<option value="${escapeHtml(sev)}">${escapeHtml(sev)}</option>`)
      .join('')}`;
    if (filters.severity) severityFilter.value = filters.severity;
  }

  const statusFilter = document.getElementById('alertFilterStatus');
  if (statusFilter) {
    const statuses = [...new Set(alerts.map((a) => a.status).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
    statusFilter.innerHTML = `<option value="">${tr('allState')}</option>${statuses
      .map((st) => `<option value="${escapeHtml(st)}">${escapeHtml(st)}</option>`)
      .join('')}`;
    if (filters.status) statusFilter.value = filters.status;
  }
}

function computeAlertStats(alerts) {
  const byType = {};
  alerts.forEach((a) => {
    const type = a.subCategory || a.type || 'unknown';
    if (!byType[type]) byType[type] = { unresolved: 0, resolved: 0 };
    if (a.status === 'resolved') byType[type].resolved++;
    else byType[type].unresolved++;
  });
  return { byType };
}

async function loadAlertsTab() {
  const filters = alertFilters();
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key === 'center' ? 'center' : key, value);
  });
  const queryString = params.toString() ? `?${params.toString()}` : '';

  const [alerts, allAlerts] = await Promise.all([
    apiGet(`/api/admin/alerts${queryString}`),
    apiGet('/api/admin/alerts'),
  ]);

  populateAlertOptions(allAlerts, filters);

  document.getElementById('alertsTableBody').innerHTML = alerts
    .length
    ? alerts
        .map(
          (a) => `
      <tr data-alert-id="${escapeHtml(a.id)}">
        <td>${escapeHtml(a.centerName || a.centerCode || '—')}</td>
        <td>${escapeHtml(a.subCategory || a.type || '—')}</td>
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
      const alertId = btn.getAttribute('data-resolve');
      await apiSend(`/api/alerts/${encodeURIComponent(alertId)}/resolve`, 'PATCH');
      removeControlAlertRow(alertId);
      await refreshAlertsStats();
    });
  });

  renderAlertsChart(computeAlertStats(alerts));
}

async function refreshAlertsStats() {
  const filters = alertFilters();
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key === 'center' ? 'center' : key, value);
  });
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const alerts = await apiGet(`/api/admin/alerts${queryString}`);
  renderAlertsChart(computeAlertStats(alerts));
}

let _allDevices = null;

async function loadDevicesTab() {
  const centerSel = document.getElementById('deviceFilterCenter');
  const roomSel = document.getElementById('deviceFilterRoom');
  const typeFilter = document.getElementById('deviceFilterType');
  const stateFilter = document.getElementById('deviceFilterState');

  _allDevices = await apiGet('/api/admin/devices');

  // Build center map from device data
  const centerMap = {};
  _allDevices.forEach(d => {
    if (d.centerCode) centerMap[d.centerCode] = d.centerName || d.centerCode;
  });

  const savedCenter = centerSel.value;
  centerSel.innerHTML = `<option value="">${tr('allCenters')}</option>` +
    Object.entries(centerMap)
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([code, name]) => `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`)
      .join('');
  if (savedCenter) centerSel.value = savedCenter;

  // Populate type filter
  const savedType = typeFilter.value;
  const types = [...new Set(_allDevices.map(d => d.deviceCategory || d.category).filter(Boolean))].sort();
  typeFilter.innerHTML = `<option value="">${tr('allTypes')}</option>` +
    types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  if (savedType) typeFilter.value = savedType;

  // Wire center change → populate room filter
  centerSel.onchange = () => {
    const code = centerSel.value;
    roomSel.value = '';
    if (code) {
      const names = [...new Set(
        _allDevices.filter(d => d.centerCode === code).map(d => d.roomName).filter(Boolean)
      )].sort();
      roomSel.innerHTML = `<option value="">${tr('filterAllRooms')}</option>` +
        names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
      roomSel.style.display = '';
    } else {
      roomSel.innerHTML = `<option value="">${tr('filterAllRooms')}</option>`;
      roomSel.style.display = 'none';
    }
    renderDevicesHierarchy();
  };
  roomSel.onchange = () => renderDevicesHierarchy();
  typeFilter.onchange = () => renderDevicesHierarchy();
  stateFilter.onchange = () => renderDevicesHierarchy();

  // Restore room options if center was pre-selected
  if (savedCenter) {
    const names = [...new Set(
      _allDevices.filter(d => d.centerCode === savedCenter).map(d => d.roomName).filter(Boolean)
    )].sort();
    if (names.length) {
      roomSel.innerHTML = `<option value="">${tr('filterAllRooms')}</option>` +
        names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
      roomSel.style.display = '';
    }
  }

  renderDevicesHierarchy();
}

function renderDevicesHierarchy() {
  if (!_allDevices) return;
  const centerVal = document.getElementById('deviceFilterCenter')?.value || '';
  const roomVal = document.getElementById('deviceFilterRoom')?.value || '';
  const typeVal = document.getElementById('deviceFilterType')?.value || '';
  const stateVal = document.getElementById('deviceFilterState')?.value || '';

  const filtered = _allDevices
    .filter(d => !centerVal || d.centerCode === centerVal)
    .filter(d => !roomVal || d.roomName === roomVal)
    .filter(d => !typeVal || d.deviceCategory === typeVal || d.category === typeVal)
    .filter(d => !stateVal || (d.deviceState || '').toLowerCase() === stateVal);

  // Group: center → room → devices
  const byCenter = new Map();
  filtered.forEach(d => {
    const ck = d.centerCode || 'other';
    const cn = d.centerName || ck;
    const rk = d.roomName || '—';
    if (!byCenter.has(ck)) byCenter.set(ck, { name: cn, rooms: new Map() });
    const rooms = byCenter.get(ck).rooms;
    if (!rooms.has(rk)) rooms.set(rk, []);
    rooms.get(rk).push(d);
  });

  const body = document.getElementById('devicesTableBody');
  if (!byCenter.size) {
    body.innerHTML = `<tr><td colspan="6"><div class="small">${tr('noDevices')}</div></td></tr>`;
    return;
  }

  let html = '';
  for (const [ck, centerData] of byCenter) {
    const totalCount = [...centerData.rooms.values()].reduce((s, devs) => s + devs.length, 0);
    html += `<tr class="group-center" data-center-id="${escapeHtml(ck)}">
      <td colspan="6">
        <span class="group-arrow">▼</span>
        <strong>${escapeHtml(centerData.name)}</strong>
        <span class="group-count">(${totalCount})</span>
      </td>
    </tr>`;

    for (const [rk, devs] of centerData.rooms) {
      html += `<tr class="group-room" data-center-id="${escapeHtml(ck)}" data-room-name="${escapeHtml(rk)}">
        <td colspan="6" style="padding-left:22px">
          <span class="group-arrow">▼</span>
          ${escapeHtml(rk)}
          <span class="group-count">(${devs.length})</span>
        </td>
      </tr>`;

      devs.forEach(d => {
        html += `<tr class="device-row" data-center-id="${escapeHtml(ck)}" data-room-name="${escapeHtml(rk)}">
          <td style="padding-left:36px">${escapeHtml(d.name || d.id)}</td>
          <td>${escapeHtml(d.roomName || '—')}</td>
          <td>${escapeHtml(d.deviceCategory || d.category || '—')}</td>
          <td>${badgeForState(d.deviceState)}</td>
          <td>${deviceBatteryBar(Math.round(Number(d.batteryLevel || 0) * 100))}</td>
          <td>${escapeHtml(d.lastReading || d.dateModified || '—')}</td>
        </tr>`;
      });
    }
  }
  body.innerHTML = html;

  // Wire collapse/expand on center headers
  body.querySelectorAll('tr.group-center').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const cid = hdr.dataset.centerId;
      const isCollapsed = hdr.classList.toggle('collapsed');
      body.querySelectorAll('tr').forEach(row => {
        if (row !== hdr && row.dataset.centerId === cid) {
          row.hidden = isCollapsed;
          if (!isCollapsed && row.classList.contains('group-room')) {
            row.classList.remove('collapsed');
          }
        }
      });
    });
  });

  // Wire collapse/expand on room headers
  body.querySelectorAll('tr.group-room').forEach(hdr => {
    hdr.addEventListener('click', (e) => {
      e.stopPropagation();
      const cid = hdr.dataset.centerId;
      const rName = hdr.dataset.roomName;
      const isCollapsed = hdr.classList.toggle('collapsed');
      body.querySelectorAll('tr.device-row').forEach(row => {
        if (row.dataset.centerId === cid && row.dataset.roomName === rName) {
          row.hidden = isCollapsed;
        }
      });
    });
  });
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
  const sock = ensureSocket();
  sock.on('alerts', async (data) => {
    if (data && data.action === 'resolved' && data.alertId) {
      const removed = removeControlAlertRow(data.alertId);
      if (removed) {
        await refreshAlertsStats();
        return;
      }
    }
    await loadAlertsTab();
  });
  sock.on('devices', () => loadDevicesTab());
  sock.on('update', () => refreshAlertsStats().catch(() => {}));
});

document.addEventListener('aura:langchange', () => {
  if (document.body.getAttribute('data-page') !== 'control-center') return;
  loadAlertsTab().catch(() => {});
  if (_allDevices) loadDevicesTab().catch(() => {});
});
