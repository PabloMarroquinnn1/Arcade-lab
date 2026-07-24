const socket = io('/dibuja-y-adivina', { transports: ['websocket'] });

const screenRoot = document.getElementById('screenRoot');
const roomBadge = document.getElementById('roomBadge');
const roomCodeEl = document.getElementById('roomCode');

let myId = null;
let currentRoom = { codigo: null, hostId: null, jugadores: [] };
let miPalabra = null; // solo la tiene quien dibuja
let amIDrawer = false;
let countdownInterval = null;
let ctx = null;
let drawingLocally = false;

socket.on('connect', () => {
  myId = socket.id;
});

socket.on('salaCreada', ({ codigo }) => {
  currentRoom.codigo = codigo;
  showRoomBadge(codigo);
});

socket.on('unidoASala', ({ codigo }) => {
  currentRoom.codigo = codigo;
  showRoomBadge(codigo);
});

socket.on('errorSala', ({ mensaje }) => {
  const errorEl = document.getElementById('formError');
  if (errorEl) errorEl.textContent = mensaje;
});

socket.on('estadoSala', (data) => {
  currentRoom.hostId = data.hostId;
  currentRoom.jugadores = data.jugadores;
  if (data.status === 'lobby') renderLobby();
});

socket.on('tuPalabra', ({ palabra }) => {
  miPalabra = palabra;
});

socket.on('rondaInicio', (data) => {
  amIDrawer = data.dibujanteId === myId;
  renderRound(data);
});

socket.on('trazoInicio', ({ x, y }) => {
  if (amIDrawer || !ctx) return;
  ctx.beginPath();
  ctx.moveTo(x, y);
});

socket.on('trazoContinua', ({ x, y }) => {
  if (amIDrawer || !ctx) return;
  ctx.lineTo(x, y);
  ctx.stroke();
});

socket.on('trazoFin', () => {
  // nada que hacer del lado de quien mira: el trazo ya quedo dibujado
});

socket.on('limpiarCanvas', () => {
  if (amIDrawer || !ctx) return;
  const canvas = document.getElementById('drawSurface');
  if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('chat', ({ nombre, texto }) => {
  appendChatLine(`<strong>${escapeHtml(nombre)}:</strong> ${escapeHtml(texto)}`, 'chat-line');
});

socket.on('acierto', ({ nombre, puntos }) => {
  appendChatLine(`🎉 ${escapeHtml(nombre)} adivinó (+${puntos} pts)`, 'chat-line acierto');
});

socket.on('rondaFin', (data) => {
  clearInterval(countdownInterval);
  amIDrawer = false;
  miPalabra = null;
  renderResults(data);
});

socket.on('partidaTerminada', (data) => {
  clearInterval(countdownInterval);
  renderFinal(data);
});

socket.on('disconnect', () => {
  clearInterval(countdownInterval);
  screenRoot.innerHTML = '<div class="error-text">Se perdió la conexión con el servidor.</div>';
});

function showRoomBadge(codigo) {
  roomBadge.style.display = '';
  roomCodeEl.textContent = codigo;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---------- Pantalla: entrada ----------

function renderEntrada() {
  screenRoot.classList.remove('wide');
  screenRoot.innerHTML = `
    <div class="lobby-card">
      <h2 class="final-title" style="font-size:1.3rem">DIBUJA Y ADIVINA</h2>
      <p class="final-sub">Creá una sala nueva o unite con un código. Necesitás al menos 2 personas.</p>

      <div class="room-form">
        <input id="nombreInput" type="text" placeholder="Tu nombre" maxlength="20" />
        <button class="primary-btn" id="crearBtn" type="button">Crear sala</button>
      </div>

      <p class="final-sub" style="margin:20px 0 8px">— o —</p>

      <div class="room-form">
        <input id="codigoInput" type="text" placeholder="CÓDIGO" maxlength="4" />
        <button class="primary-btn" id="unirseBtn" type="button">Unirme</button>
      </div>

      <p id="formError" class="error-text"></p>
    </div>
  `;

  document.getElementById('crearBtn').addEventListener('click', () => {
    const nombre = document.getElementById('nombreInput').value.trim() || 'Jugador';
    socket.emit('crearSala', { nombre });
  });

  document.getElementById('unirseBtn').addEventListener('click', () => {
    const nombre = document.getElementById('nombreInput').value.trim() || 'Jugador';
    const codigo = document.getElementById('codigoInput').value.trim();
    if (!codigo) {
      document.getElementById('formError').textContent = 'Escribí un código de sala.';
      return;
    }
    socket.emit('unirseSala', { nombre, codigo });
  });
}

// ---------- Pantalla: lobby ----------

function renderLobby() {
  screenRoot.classList.remove('wide');
  const soyHost = currentRoom.hostId === myId;
  const alcanza = currentRoom.jugadores.length >= 2;

  screenRoot.innerHTML = `
    <div class="lobby-card">
      <div class="room-code-display">${currentRoom.codigo}</div>
      <p class="final-sub">Compartí este código para que se unan (mínimo 2 jugadores)</p>
      <ul class="players-list">
        ${currentRoom.jugadores
          .map((j) => `<li>${escapeHtml(j.nombre)}${j.id === currentRoom.hostId ? ' (anfitrión)' : ''}${j.id === myId ? ' — vos' : ''}</li>`)
          .join('')}
      </ul>
      ${
        soyHost
          ? `<button class="primary-btn" id="empezarBtn" type="button" ${alcanza ? '' : 'disabled'}>Empezar partida</button>`
          : '<p class="final-sub">Esperando a que el anfitrión empiece...</p>'
      }
      <p id="formError" class="error-text"></p>
    </div>
  `;

  if (soyHost) {
    document.getElementById('empezarBtn').addEventListener('click', () => {
      socket.emit('empezarPartida');
    });
  }
}

// ---------- Pantalla: ronda (dibujar / adivinar) ----------

function renderRound(data) {
  screenRoot.classList.add('wide');
  const hint = amIDrawer ? `TU PALABRA: ${miPalabra || ''}` : '_ '.repeat(data.largoPalabra).trim();

  screenRoot.innerHTML = `
    <div class="round-info">
      <span>${amIDrawer ? 'Te toca dibujar' : `Dibuja: ${escapeHtml(data.dibujanteNombre)}`}</span>
      <span id="timerLabel">${Math.ceil(data.tiempoMs / 1000)}s</span>
    </div>
    <div class="timer-bar-wrap"><div id="timerBar" class="timer-bar" style="width:100%"></div></div>
    <div class="word-hint${amIDrawer ? ' mine' : ''}" id="wordHint">${hint}</div>

    <div class="draw-area">
      <canvas id="drawSurface" width="300" height="300" class="${amIDrawer ? 'mine' : ''}"></canvas>
    </div>

    ${amIDrawer ? '<div class="draw-tools"><button class="secondary-btn" id="clearBtn" type="button">Borrar todo</button></div>' : ''}

    <div class="chat-log" id="chatLog"></div>

    ${
      amIDrawer
        ? ''
        : `<form class="chat-form" id="chatForm">
             <input id="chatInput" type="text" placeholder="Escribí tu intento..." autocomplete="off" maxlength="100" />
             <button class="primary-btn" type="submit">Enviar</button>
           </form>`
    }
  `;

  const canvas = document.getElementById('drawSurface');
  ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (amIDrawer) {
    setupDrawerCanvas(canvas);
    document.getElementById('clearBtn').addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      socket.emit('limpiarCanvas');
    });
  } else {
    const chatForm = document.getElementById('chatForm');
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chatInput');
      const texto = input.value.trim();
      if (!texto) return;
      socket.emit('mensaje', { texto });
      input.value = '';
    });
  }

  const totalMs = data.tiempoMs;
  const startedAt = performance.now();
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    const leftMs = Math.max(0, totalMs - (performance.now() - startedAt));
    const bar = document.getElementById('timerBar');
    const label = document.getElementById('timerLabel');
    if (!bar || !label) return clearInterval(countdownInterval);
    const pct = (leftMs / totalMs) * 100;
    bar.style.width = `${pct}%`;
    bar.style.backgroundColor = pct < 25 ? '#ff4466' : pct < 55 ? '#ffcc00' : '#00ff88';
    label.textContent = `${Math.ceil(leftMs / 1000)}s`;
    if (leftMs <= 0) clearInterval(countdownInterval);
  }, 100);
}

// Pointer Events: unifica mouse, dedo y lapiz (S Pen, Surface Pen, etc.) en
// un solo set de eventos — ver docs/aprende/04-que-es-una-api.md.
function setupDrawerCanvas(canvas) {
  function toCanvasXY(e) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  }

  canvas.addEventListener('pointerdown', (e) => {
    drawingLocally = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = toCanvasXY(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    socket.emit('trazoInicio', { x, y });
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drawingLocally) return;
    const { x, y } = toCanvasXY(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    socket.emit('trazoContinua', { x, y });
  });

  function stopDrawing() {
    if (!drawingLocally) return;
    drawingLocally = false;
    socket.emit('trazoFin');
  }

  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointercancel', stopDrawing);
  canvas.addEventListener('pointerleave', stopDrawing);
}

// ---------- Pantalla: resultados de la ronda ----------

function renderResults(data) {
  const rankingHtml = renderRankingList(data.ranking);
  const chatLog = document.getElementById('chatLog');
  if (chatLog) {
    const revealDiv = document.createElement('div');
    revealDiv.innerHTML = `<p class="feedback-text reveal">La palabra era: <strong>${escapeHtml(data.palabra)}</strong></p>${rankingHtml}`;
    screenRoot.appendChild(revealDiv);
  } else {
    screenRoot.innerHTML = `<p class="feedback-text reveal">La palabra era: <strong>${escapeHtml(data.palabra)}</strong></p>${rankingHtml}`;
  }
}

function appendChatLine(html, className) {
  const chatLog = document.getElementById('chatLog');
  if (!chatLog) return;
  const line = document.createElement('div');
  line.className = className;
  line.innerHTML = html;
  chatLog.appendChild(line);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ---------- Pantalla: partida terminada ----------

function renderFinal(data) {
  screenRoot.classList.remove('wide');
  screenRoot.innerHTML = `
    <div class="final-title">¡PARTIDA TERMINADA!</div>
    ${renderRankingList(data.ranking)}
    <p class="final-sub" style="margin-top:20px">Volviendo al lobby...</p>
  `;
}

function renderRankingList(ranking) {
  return `
    <ul class="ranking-list">
      ${ranking
        .map(
          (j, i) => `
        <li class="ranking-item${j.id === myId ? ' me' : ''}">
          <span><span class="ranking-pos">#${i + 1}</span>${escapeHtml(j.nombre)}</span>
          <span>${j.puntaje} pts</span>
        </li>`
        )
        .join('')}
    </ul>
  `;
}

renderEntrada();
