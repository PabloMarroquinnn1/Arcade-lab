const socket = io('/trivia', { transports: ['websocket'] });

const screenRoot = document.getElementById('screenRoot');
const roomBadge = document.getElementById('roomBadge');
const roomCodeEl = document.getElementById('roomCode');

let myId = null;
let currentRoom = { codigo: null, hostId: null, jugadores: [], status: 'entrada' };
let countdownInterval = null;

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
  // Solo forzamos el cambio de pantalla si estamos en el lobby (o volviendo a
  // el). Si esto llega mientras hay una pregunta en curso (porque alguien
  // mas se unio o se fue), no interrumpimos la vista de la pregunta.
  if (data.status === 'lobby') {
    currentRoom.status = 'lobby';
    renderLobby();
  }
});

socket.on('pregunta', (data) => {
  currentRoom.status = 'question';
  renderQuestion(data);
});

socket.on('resultados', (data) => {
  currentRoom.status = 'results';
  renderResults(data);
});

socket.on('partidaTerminada', (data) => {
  currentRoom.status = 'finished';
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

// ---------- Pantalla: entrada (crear o unirse) ----------

function renderEntrada() {
  screenRoot.innerHTML = `
    <div class="lobby-card">
      <h2 class="final-title" style="font-size:1.4rem">TRIVIA EN SALAS</h2>
      <p class="final-sub">Creá una sala nueva o unite con un código</p>

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
  const soyHost = currentRoom.hostId === myId;
  screenRoot.innerHTML = `
    <div class="lobby-card">
      <div class="room-code-display">${currentRoom.codigo}</div>
      <p class="final-sub">Compartí este código para que se unan</p>
      <ul class="players-list">
        ${currentRoom.jugadores
          .map((j) => `<li>${j.nombre}${j.id === currentRoom.hostId ? ' (anfitrión)' : ''}${j.id === myId ? ' — vos' : ''}</li>`)
          .join('')}
      </ul>
      ${
        soyHost
          ? '<button class="primary-btn" id="empezarBtn" type="button">Empezar partida</button>'
          : '<p class="final-sub">Esperando a que el anfitrión empiece...</p>'
      }
    </div>
  `;

  if (soyHost) {
    document.getElementById('empezarBtn').addEventListener('click', () => {
      socket.emit('empezarPartida');
    });
  }
}

// ---------- Pantalla: pregunta ----------

function renderQuestion(data) {
  clearInterval(countdownInterval);
  let answered = false;

  screenRoot.innerHTML = `
    <div class="progress-row">
      <span>Pregunta ${data.indice + 1} / ${data.total}</span>
      <span id="timerLabel">${Math.ceil(data.tiempoMs / 1000)}s</span>
    </div>
    <div class="timer-bar-wrap"><div id="timerBar" class="timer-bar" style="width:100%"></div></div>
    <div class="question-text">${data.pregunta}</div>
    <div class="options-grid">
      ${data.opciones.map((op, i) => `<button class="option-btn" data-index="${i}">${op}</button>`).join('')}
    </div>
  `;

  document.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      btn.classList.add('selected');
      document.querySelectorAll('.option-btn').forEach((b) => (b.disabled = true));
      socket.emit('responder', { opcionIndex: Number(btn.dataset.index) });
    });
  });

  const totalMs = data.tiempoMs;
  const startedAt = performance.now();
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

// ---------- Pantalla: resultados ----------

function renderResults(data) {
  clearInterval(countdownInterval);
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === data.correcta) btn.classList.add('correct');
    else if (btn.classList.contains('selected')) btn.classList.add('incorrect');
  });

  const rankingHtml = renderRankingList(data.ranking);
  const rankingContainer = document.createElement('div');
  rankingContainer.innerHTML = `<h3 class="final-sub" style="margin-top:20px">Ranking</h3>${rankingHtml}`;
  screenRoot.appendChild(rankingContainer);
}

// ---------- Pantalla: partida terminada ----------

function renderFinal(data) {
  clearInterval(countdownInterval);
  screenRoot.innerHTML = `
    <div class="final-card">
      <div class="final-title">¡PARTIDA TERMINADA!</div>
      ${renderRankingList(data.ranking)}
      <p class="final-sub" style="margin-top:20px">Volviendo al lobby...</p>
    </div>
  `;
}

function renderRankingList(ranking) {
  return `
    <ul class="ranking-list">
      ${ranking
        .map(
          (j, i) => `
        <li class="ranking-item${j.id === myId ? ' me' : ''}">
          <span><span class="ranking-pos">#${i + 1}</span>${j.nombre}</span>
          <span>${j.puntaje} pts</span>
        </li>`
        )
        .join('')}
    </ul>
  `;
}

renderEntrada();
