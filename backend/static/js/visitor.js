function poiFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[1]);
}

function airBadge(status) {
  if (status === 'excellent') return `<span class="badge optimal">${tr('airExcellent')}</span>`;
  if (status === 'acceptable') return `<span class="badge attention">${tr('airAcceptable')}</span>`;
  return `<span class="badge critical">${tr('airImproving')}</span>`;
}

async function loadVisitorData() {
  const poi = poiFromPath();
  const [summary, recommended] = await Promise.all([
    apiGet(`/api/public/poi/${encodeURIComponent(poi)}/summary`),
    apiGet(`/api/public/poi/${encodeURIComponent(poi)}/recommended-room`),
  ]);

  document.getElementById('visitorTitle').textContent = summary.center.name;
  document.getElementById('airStatus').innerHTML = airBadge(summary.airStatus);
  document.getElementById('co2Val').textContent = formatMetric(summary.snapshot.avgCo2, { digits: 0, unit: 'ppm' });
  document.getElementById('tempVal').textContent = formatMetric(summary.snapshot.avgTemperature, { unit: '°C' });
  document.getElementById('humVal').textContent = formatMetric(summary.snapshot.avgHumidity, { unit: '%' });
  document.getElementById('occVal').textContent = formatMetric(summary.snapshot.avgOccupancy, { digits: 0, unit: '%', zeroAsMissing: false });

  if (recommended && recommended.room) {
    document.getElementById('recommendedRoom').textContent =
      `${tr('recommendation')}: ${recommended.room.name} (${tr('recommendationIndex')} ${formatMetric(recommended.comfortIndex, { digits: 1, zeroAsMissing: false })})`;
  }
}

function appendChat(role, text) {
  const box = document.getElementById('chatBox');
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  el.textContent = text;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

async function askChat() {
  const poi = poiFromPath();
  const input = document.getElementById('chatInput');
  const question = input.value.trim();
  if (!question) return;

  appendChat('user', question);
  input.value = '';

  try {
    const start = performance.now();
    const res = await apiSend('/api/public/chat/ask', 'POST', {
      poi_id: poi,
      question,
      language: AURA.lang,
    });
    const elapsed = Math.round(performance.now() - start);
    appendChat('bot', `${res.answer} (${elapsed} ms)`);
  } catch (err) {
    appendChat('bot', tr('noDataAvailable'));
  }
}

function wireChat() {
  document.getElementById('chatSend').addEventListener('click', askChat);
  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') askChat();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.getAttribute('data-page') !== 'visitor') return;
  wireChat();
  loadVisitorData().catch((err) => console.error(err));
  setInterval(() => loadVisitorData().catch((err) => console.error(err)), 60000);
});
