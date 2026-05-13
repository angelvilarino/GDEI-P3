/* ═══════════════════════════════════════════
   AuraBot — Chatbot flotante (solo Modo Visitante)
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  // Solo se monta en Modo Visitante
  const inVisitorMode = typeof isVisitorMode === 'function' && isVisitorMode();
  const isVisitorPage = document.body.getAttribute('data-page') === 'visitor';
  if (!inVisitorMode && !isVisitorPage) return;

  const SESSION_KEY = 'aurabot_history';

  /* ── Crear elementos ── */
  const fab = document.createElement('button');
  fab.id = 'chatbot-fab';
  fab.setAttribute('aria-label', 'Abrir AuraBot');
  fab.setAttribute('title', 'Abrir AuraBot');
  fab.innerHTML = '<i class="fas fa-comments"></i>';

  // Estilos críticos inline para garantizar visibilidad
  Object.assign(fab.style, {
    position:     'fixed',
    bottom:       '28px',
    right:        '28px',
    zIndex:       '99999',
    width:        '56px',
    height:       '56px',
    borderRadius: '50%',
    background:   'var(--accent, #0e7c74)',
    color:        '#fff',
    border:       'none',
    cursor:       'pointer',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    fontSize:     '1.3rem',
    boxShadow:    '0 4px 20px rgba(0,0,0,0.32)',
    transition:   'transform 0.18s ease, background 0.18s ease',
  });

  const panel = document.createElement('div');
  panel.id = 'chatbot-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'AuraBot');
  panel.innerHTML = `
    <div id="chatbot-header">
      <span class="chatbot-title"><i class="fas fa-robot"></i> AuraBot</span>
      <div class="chatbot-actions">
        <button id="chatbot-clear" title="${typeof tr === 'function' ? tr('chatClear') || 'Limpiar conversación' : 'Limpiar conversación'}"><i class="fas fa-trash-can"></i></button>
        <button id="chatbot-close" title="${typeof tr === 'function' ? tr('chatClose') || 'Cerrar' : 'Cerrar'}"><i class="fas fa-xmark"></i></button>
      </div>
    </div>
    <div id="chatbot-messages"></div>
    <div id="chatbot-input-row">
      <input id="chatbot-input" type="text" placeholder="${typeof tr === 'function' ? tr('placeholderChat') || 'Pregunta sobre la sala, obras, ambiente…' : 'Pregunta sobre la sala, obras, ambiente…'}" maxlength="400" />
      <button id="chatbot-send" title="${typeof tr === 'function' ? tr('send') || 'Enviar' : 'Enviar'}"><i class="fas fa-paper-plane"></i></button>
    </div>
  `;

  // Estilos críticos del panel inline
  Object.assign(panel.style, {
    position:    'fixed',
    bottom:      '96px',
    right:       '28px',
    zIndex:      '99998',
    width:       '350px',
    height:      '500px',
    display:     'none',   // oculto hasta abrir
    flexDirection: 'column',
    overflow:    'hidden',
    borderRadius: '16px',
    boxShadow:   '0 8px 40px rgba(0,0,0,0.28)',
  });

  document.body.appendChild(panel);
  document.body.appendChild(fab);

  const messagesEl = panel.querySelector('#chatbot-messages');
  const inputEl    = panel.querySelector('#chatbot-input');
  const sendBtn    = panel.querySelector('#chatbot-send');
  const closeBtn   = panel.querySelector('#chatbot-close');
  const clearBtn   = panel.querySelector('#chatbot-clear');
  let isOpen = false;

  /* ── Historial ── */
  function loadHistory()  { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || []; } catch { return []; } }
  function saveHistory(h) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(h.slice(-40))); }

  /* ── Render mensajes ── */
  function renderMessages() {
    const h = loadHistory();
    messagesEl.innerHTML = '';
    if (!h.length) {
      const welcome = typeof tr === 'function' ? tr('chatWelcome') : 'Hola, soy AuraBot. Pregúntame sobre las obras expuestas, el ambiente de la sala o la historia del centro.';
      messagesEl.innerHTML = `
        <div class="chatbot-welcome">
          <i class="fas fa-robot"></i>
          <strong>AuraBot</strong>
          ${escapeHtml(welcome)}
        </div>`;
      return;
    }
    h.forEach(m => addBubble(m.role, m.content, false));
    scrollDown();
  }

  function addBubble(role, text, animate = true) {
    const d = document.createElement('div');
    d.className = `chatbot-msg ${role === 'user' ? 'user' : 'bot'}`;
    d.textContent = text;
    if (!animate) d.style.animation = 'none';
    messagesEl.appendChild(d);
    return d;
  }

  function scrollDown() { messagesEl.scrollTop = messagesEl.scrollHeight; }

  /* ── Abrir / Cerrar ── */
  function openPanel() {
    isOpen = true;
    panel.style.display = 'flex';
    panel.classList.add('chatbot-open');
    fab.querySelector('i').className = 'fas fa-xmark';
    renderMessages();
    setTimeout(() => inputEl.focus(), 100);
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('chatbot-open');
    panel.style.display = 'none';
    fab.querySelector('i').className = 'fas fa-comments';
  }

  fab.addEventListener('click', () => (isOpen ? closePanel() : openPanel()));
  closeBtn.addEventListener('click', closePanel);
  clearBtn.addEventListener('click', () => { sessionStorage.removeItem(SESSION_KEY); renderMessages(); });

  /* ── Enviar mensaje ── */
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || sendBtn.disabled) return;
    inputEl.value = '';
    sendBtn.disabled = true;

    const history = loadHistory();
    history.push({ role: 'user', content: text });
    saveHistory(history);

    if (messagesEl.querySelector('.chatbot-welcome')) messagesEl.innerHTML = '';
    addBubble('user', text);

    const typing = document.createElement('div');
    typing.className = 'chatbot-msg bot typing';
    typing.textContent = tr('aurabotThinking');
    messagesEl.appendChild(typing);
    scrollDown();

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          pageUrl: window.location.pathname,
          context: window.AURABOT_CONTEXT || null,
          lang: AURA.lang,
        }),
      });
      const data = await resp.json();
      typing.remove();

      if (data.error) {
        const e = document.createElement('div');
        e.className = 'chatbot-msg error';
        e.textContent = data.error;
        messagesEl.appendChild(e);
      } else {
        history.push({ role: 'model', content: data.reply });
        saveHistory(history);
        addBubble('bot', data.reply);
      }
    } catch {
      typing.remove();
      const e = document.createElement('div');
      e.className = 'chatbot-msg error';
      e.textContent = tr('connectionError');
      messagesEl.appendChild(e);
    }

    sendBtn.disabled = false;
    scrollDown();
    inputEl.focus();
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
});
