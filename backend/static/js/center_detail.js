let gaugeCharts = {};
let historyCharts = {};

function centerCodeFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[1];
}

function gaugeConfig(value, max, color) {
  return {
    type: 'doughnut',
    data: {
      labels: ['value', 'rest'],
      datasets: [
        {
          data: [Math.max(0, Math.min(max, value)), Math.max(0, max - value)],
          backgroundColor: [color, '#d8d8d833'],
          borderWidth: 0,
          cutout: '72%',
        },
      ],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      responsive: true,
      maintainAspectRatio: false,
    },
  };
}

function setKpiText(id, value, max, color, label) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (gaugeCharts[id]) gaugeCharts[id].destroy();
  gaugeCharts[id] = new Chart(ctx, gaugeConfig(value, max, color));
  document.getElementById(`${id}-value`).textContent = `${formatMetric(value, { digits: 1, zeroAsMissing: true })} ${label}`;
}

async function loadCenterSnapshot(code) {
  const center = await apiGet(`/api/centers/${code}`);
  const snap = center.snapshot;
  document.getElementById('centerTitle').textContent = center.name;
  document.getElementById('centerStatus').innerHTML = statusBadge(snap.status);

  document.getElementById('gTemp-value').textContent = formatMetric(snap.avgTemperature, { digits: 1, zeroAsMissing: true });
  document.getElementById('gHum-value').textContent = formatMetric(snap.avgHumidity, { digits: 1, zeroAsMissing: true });
  document.getElementById('gCo2-value').textContent = formatMetric(snap.avgCo2, { digits: 0, zeroAsMissing: true });
  document.getElementById('gNoise-value').textContent = formatMetric(snap.avgNoise, { digits: 1, zeroAsMissing: true });
  
  let occPct = snap.avgOccupancy ? snap.avgOccupancy * 100 : null;
  document.getElementById('gOcc-value').textContent = formatMetric(snap.peopleCount || 0, { digits: 0, zeroAsMissing: false });
  document.getElementById('gOcc-pct').textContent = formatMetric(occPct, { digits: 0, zeroAsMissing: false });
}

async function loadRooms(code) {
  const rooms = await apiGet(`/api/centers/${code}/rooms`);
  const list = document.getElementById('roomsList');
  const FALLBACK_IMG = 'https://picsum.photos/id/376/400/200';
  list.innerHTML = rooms
    .map(
      (r) => `
      <div class="card room-card">
        <img class="room-img" src="${r.image || FALLBACK_IMG}" alt="${escapeHtml(r.name)}" onerror="this.src='${FALLBACK_IMG}'" />
        <div class="room-info">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <strong>${escapeHtml(r.name)}</strong>
            ${statusBadge(r.status)}
          </div>
          <div class="small">${tr('occupancy')}: ${formatMetric(Number(r.current.occupancy || 0) * 100, { digits: 0, unit: '%', zeroAsMissing: false })}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
            <a class="btn room-btn" href="/room/${encodeURIComponent(r.id)}">${tr('viewDetail')}</a>
          </div>
        </div>
      </div>
    `
    )
    .join('');
}

async function loadRiskArtworks(code) {
  const list = document.getElementById('riskList');
  if (!list) return;
  const arts = await apiGet(`/api/centers/${code}/artworks/at-risk`);
  const card = document.getElementById('riskWorksCard');
  if (!arts.length) {
    if (card) card.style.display = 'none';
    return;
  }
  if (card) card.style.display = '';
  list.innerHTML = arts
    .slice(0, 12)
    .map(
      (a) => `<div class="alert-item ${Number(a.degradationRisk) > 0.8 ? 'critical' : ''}"><strong>${escapeHtml(a.name)}</strong><br/><span class="small">${escapeHtml(a.artist || '')} · ${tr('severity')} ${formatMetric(a.degradationRisk, { digits: 3, zeroAsMissing: false })}</span></div>`
    )
    .join('');
}

function buildSingleChart(id, label, data, rawLabels, color, unit, range) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (historyCharts[id]) historyCharts[id].destroy();
  historyCharts[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rawLabels,
      datasets: [{
        label: label,
        data: data,
        borderColor: color,
        backgroundColor: `${color}22`,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            title(context) {
                const ts = context[0].label;
                const d = new Date(ts);
                if (Number.isNaN(d.getTime())) return ts;
                const locale = AURA.lang === 'en' ? 'en-GB' : 'es-ES';
                return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            },
            label(context) {
              return `${label}: ${formatMetric(context.parsed.y, { digits: 1, unit, zeroAsMissing: false })}`;
            }
          }
        }
      },
      scales: {
        x: {
            ticks: {
                maxRotation: 0,
                autoSkip: false,
                callback: function(val, index) {
                    const ts = rawLabels[index];
                    if (!ts) return '';
                    const d = new Date(ts);
                    if (Number.isNaN(d.getTime())) return '';
                    
                    const m = d.getMinutes();
                    const h = d.getHours();
                    const s = d.getSeconds();

                    const locale = AURA.lang === 'en' ? 'en-GB' : 'es-ES';
                    if (range === '1h') {
                        // cada 10 min
                        if (m % 10 === 0 && s < 30) {
                            return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        }
                    } else if (range === '12h') {
                        // cada hora
                        if (m === 0) {
                            return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                        }
                    } else if (range === '24h') {
                        // cada 2 horas
                        if (h % 2 === 0 && m === 0) {
                            return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                        }
                    }
                    return '';
                }
            }
        },
        y: { beginAtZero: false }
      }
    }
  });
}

async function loadHistory(code) {
  const range = document.getElementById('rangeSelect').value;
  const history = await apiGet(`/api/centers/${code}/history?range=${range}`);
  const rawLabels = history.temperature.map(p => p.timestamp);

  buildSingleChart('chartTemp', tr('temperature'), history.temperature.map(p => p.value), rawLabels, '#0e7c74', '°C', range);
  buildSingleChart('chartHum', tr('humidity'), history.relativeHumidity.map(p => p.value), rawLabels, '#3d9ecf', '%', range);
  buildSingleChart('chartCo2', tr('co2'), history.co2.map(p => p.value), rawLabels, '#d27d3f', 'ppm', range);
  buildSingleChart('chartNoise', tr('laeqLabel'), history.LAeq.map(p => p.value), rawLabels, '#7c5bd6', 'dB', range);
  buildSingleChart('chartCrowd', tr('occupancy'), history.peopleCount.map(p => p.value), rawLabels, '#a86b18', 'pax', range);
}

async function loadActuators(code) {
  const acts = await apiGet(`/api/centers/${code}/actuators`);
  const wrap = document.getElementById('actuatorPanel');
  wrap.innerHTML = acts
    .map(
      (a) => {
        const status = a.status || 'off';
        let statusText, statusColor, badgeColor, isChecked, isDisabled;
        if (status === 'on') {
          statusText = tr('actuatorActive');
          statusColor = '#2ecc71';
          badgeColor = '#2ecc71';
          isChecked = true;
          isDisabled = false;
        } else if (status === 'off') {
          statusText = tr('actuatorInactive');
          statusColor = '#e74c3c';
          badgeColor = '#e74c3c';
          isChecked = false;
          isDisabled = false;
        } else {
          statusText = tr('actuatorError');
          statusColor = '#e67e22';
          badgeColor = '#e67e22';
          isChecked = false;
          isDisabled = true;
        }
        return `
      <div class="card" style="padding:12px; align-self: start; display: flex; flex-direction: column; gap: 10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <strong style="flex:1;font-size:0.9rem;overflow:hidden;text-overflow:ellipsis">${a.name || a.id}</strong>
          <span style="width:12px;height:12px;border-radius:50%;background:${badgeColor};flex-shrink:0;"></span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:0.82rem;color:var(--muted)">${statusText}</span>
          <label class="device-toggle" data-act="${a.id}">
            <input type="checkbox" class="device-toggle__input" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
            <span class="device-toggle__slider"></span>
          </label>
        </div>
      </div>
    `;
      }
    )
    .join('');

  wrap.querySelectorAll('label.device-toggle').forEach((label) => {
    const input = label.querySelector('input');
    const id = label.getAttribute('data-act');
    input.addEventListener('change', async () => {
      try {
        const cmd = input.checked ? 'on' : 'off';
        await apiSend(`/api/actuators/${encodeURIComponent(id)}/command`, 'POST', { command: cmd });
        await loadActuators(code);
      } catch (err) {
        console.error('Toggle error:', err);
        // Revert toggle state on error
        input.checked = !input.checked;
        // Reload to show actual state
        await loadActuators(code);
      }
    });
  });
}

function airQualityLabel(co2) {
  if (!co2 || co2 < 600) return { cls: 'excellent',  label: tr('airExcellentLabel'),  text: tr('airExcellentText'),  faIcon: 'fa-wind' };
  if (co2 < 900)         return { cls: 'good',       label: tr('airGoodLabel'),       text: tr('airGoodText'),       faIcon: 'fa-wind' };
  if (co2 < 1200)        return { cls: 'acceptable', label: tr('airAcceptableLabel'), text: tr('airAcceptableText'), faIcon: 'fa-wind' };
  return                        { cls: 'improvable', label: tr('airImprovableLabel'), text: tr('airImprovableText'), faIcon: 'fa-triangle-exclamation' };
}

async function bootVisitorCenterDetail(code) {
  const [center, rooms] = await Promise.all([
    apiGet(`/api/centers/${code}`),
    apiGet(`/api/centers/${code}/rooms`).catch(() => []),
  ]);
  const snap = center.snapshot || {};

  document.getElementById('centerTitle').textContent = center.name;
  document.getElementById('centerStatus').innerHTML = '';

  document.querySelector('.gauges-row')?.style.setProperty('display', 'none');
  document.querySelector('main.stagger')?.style.setProperty('display', 'none');

  const vc = (typeof VISITOR_CONTENT !== 'undefined' ? VISITOR_CONTENT.centers[code] : null) || {};
  const aq = airQualityLabel(snap.avgCo2);
  const FALLBACK = 'https://picsum.photos/id/376/800/400';
  const imgSrc = escapeHtml(vc.image || center.image || FALLBACK);

  const infoCards = `
    <div class="visitor-info-cards">
      <div class="card visitor-info-card">
        <span class="visitor-info-card-label"><i class="fas fa-clock fa-fw"></i> ${tr('visitSchedule')}</span>
        <span class="visitor-info-card-value">${escapeHtml(vc.schedule || tr('checkSchedule'))}</span>
      </div>
      <div class="card visitor-info-card">
        <span class="visitor-info-card-label"><i class="fas fa-ticket fa-fw"></i> ${tr('entryPrice')}</span>
        <span class="visitor-info-card-value">${escapeHtml(vc.price || tr('checkPrices'))}</span>
      </div>
      <div class="card visitor-info-card">
        <span class="visitor-info-card-label"><i class="fas fa-wheelchair fa-fw"></i> ${tr('accessibilityLabel')}</span>
        <span class="visitor-info-card-value">${escapeHtml(vc.accessibility || tr('accessibleCenter'))}</span>
      </div>
    </div>`;

  const FALLBACK_ROOM = 'https://picsum.photos/id/376/400/200';
  const roomCards = rooms.map(r => {
    const link = `/room/${encodeURIComponent(r.id)}?mode=visitor`;
    return `
      <a class="card visitor-room-card" href="${link}">
        <img src="${escapeHtml(r.image || FALLBACK_ROOM)}" alt="${escapeHtml(r.name)}" onerror="this.src='${FALLBACK_ROOM}'" />
        <div class="visitor-room-card-body">
          <div class="visitor-room-name">${escapeHtml(r.name)}</div>
          <div class="visitor-room-desc">${escapeHtml(r.description || '')}</div>
        </div>
      </a>`;
  }).join('');

  const container = document.getElementById('visitorContent');
  container.innerHTML = `
    <div class="visitor-content-wrap">
      <div class="card fade-up" style="padding:18px 20px">
        <div class="visitor-hero-grid">
          <img class="visitor-center-image" src="${imgSrc}" alt="${escapeHtml(center.name)}" onerror="this.src='${FALLBACK}'" />
          <div class="visitor-info-stack">
            <div class="visitor-info-block">
              <span class="visitor-info-label">${tr('historyAndHeritage')}</span>
              <p class="visitor-info-value">${escapeHtml(vc.history || center.description || '')}</p>
            </div>
            <div class="visitor-info-block">
              <span class="visitor-info-label">${tr('aboutCenter')}</span>
              <p class="visitor-info-value">${escapeHtml(vc.culturalDescription || '')}</p>
            </div>
            <div class="visitor-air-summary ${aq.cls}">
              <div class="visitor-air-icon-wrap"><i class="fas ${aq.faIcon}"></i></div>
              <div class="visitor-air-content">
                <div class="visitor-air-quality-label">${aq.label}</div>
                <div class="visitor-air-detail">${escapeHtml(aq.text)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${infoCards}
      ${rooms.length > 0 ? `
      <div class="card visitor-rooms-section fade-up">
        <h3><i class="fas fa-door-open"></i> ${tr('centerRoomsSection')}</h3>
        <div class="visitor-rooms-scroll">${roomCards}</div>
      </div>` : ''}
    </div>`;
  container.style.display = '';

  // ── Contexto para AuraBot
  window.AURABOT_CONTEXT = {
    tipo: 'centro',
    centro: center.name || '',
    descripcion: center.description || vc.history || '',
    temperatura: snap.avgTemperature ?? null,
    humedad: snap.avgHumidity ?? null,
    co2: snap.avgCo2 ?? null,
    personas: snap.peopleCount ?? null,
    aforo: snap.avgOccupancy ?? null,
    estado: snap.status || '',
    alertasActivas: snap.activeAlerts ?? 0,
    salas: rooms.map(r => ({ nombre: r.name, descripcion: r.description || '' })),
  };
}

async function bootCenterDetail() {
  const code = centerCodeFromPath();

  if (isVisitorMode()) {
    await bootVisitorCenterDetail(code);
    return;
  }

  await Promise.all([
    loadCenterSnapshot(code),
    loadRooms(code),
    loadRiskArtworks(code),
    loadHistory(code),
    loadActuators(code),
  ]);

  document.getElementById('rangeSelect').addEventListener('change', () => loadHistory(code));

  const socket = ensureSocket();
  socket.on('update', () => loadCenterSnapshot(code));
  socket.on('actuators', () => loadActuators(code));
  socket.on('alerts', () => {
    loadRiskArtworks(code);
    loadCenterSnapshot(code);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'center-detail') return;
  bootCenterDetail().catch((err) => console.error(err));
});

document.addEventListener('aura:langchange', () => {
  if (document.body.getAttribute('data-page') !== 'center-detail') return;
  const code = centerCodeFromPath();
  if (isVisitorMode()) {
    bootVisitorCenterDetail(code).catch(() => {});
  } else {
    loadHistory(code).catch(() => {});
    loadActuators(code).catch(() => {});
  }
});
