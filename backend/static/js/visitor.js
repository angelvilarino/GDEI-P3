function poiFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[1]);
}

function airBadge(status) {
  if (status === 'excellent') return '<span class="badge optimal">Aire excelente</span>';
  if (status === 'acceptable') return '<span class="badge attention">Aire aceptable</span>';
  return '<span class="badge critical">Aire mejorable</span>';
}

async function loadVisitorData() {
  const poi = poiFromPath();
  const [summary, recommended] = await Promise.all([
    apiGet(`/api/public/poi/${encodeURIComponent(poi)}/summary`),
    apiGet(`/api/public/poi/${encodeURIComponent(poi)}/recommended-room`),
  ]);

  document.getElementById('visitorTitle').textContent = summary.center.name;
  document.getElementById('airStatus').innerHTML = airBadge(summary.airStatus);
  document.getElementById('co2Val').textContent = `${formatNumber(summary.snapshot.avgCo2, 0)} ppm`;
  document.getElementById('tempVal').textContent = `${formatNumber(summary.snapshot.avgTemperature)} C`;
  document.getElementById('humVal').textContent = `${formatNumber(summary.snapshot.avgHumidity)} %`;
  document.getElementById('occVal').textContent = `${Math.round(summary.snapshot.avgOccupancy * 100)} %`;

  if (recommended && recommended.room) {
    document.getElementById('recommendedRoom').textContent =
      `Recomendacion: ${recommended.room.name} (indice ${formatNumber(recommended.comfortIndex, 1)})`;
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
    appendChat('bot', 'No ha sido posible responder ahora mismo.');
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
