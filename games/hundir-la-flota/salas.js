const socket = io('/hundir-la-flota', { transports: ['websocket'] });

const screenRoot = document.getElementById('screenRoot');
const roomBadge = document.getElementById('roomBadge');
const roomCodeEl = document.getElementById('roomCode');

const SIZE = 10;

let myId = null;
let currentRoom = { codigo: null, hostId: null, jugadores: [] };
let turnId = null;
let myFleetGrid = null;
let firedByMe = null; // lo que le dispare al rival (r,c) -> 'hit'|'miss'|'sunk'
let firedOnMe = null; // lo que me dispararon a mi

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

socket.on('tuFlota', ({ grid }) => {
  myFleetGrid = grid;
});

socket.on('partidaInicio', (data) => {
  turnId = data.turnoDe;
  currentRoom.jugadores = data.jugadores;
  firedByMe = emptyGrid();
  firedOnMe = emptyGrid();
  renderGame();
});

socket.on('resultadoDisparo', ({ r, c, result, disparadoPor }) => {
  if (disparadoPor === myId) {
    firedByMe[r][c] = result;
  } else {
    firedOnMe[r][c] = result;
  }
  renderGame();
});

socket.on('cambioTurno', ({ turnoDe }) => {
  turnId = turnoDe;
  renderGame();
});

socket.on('partidaTerminada', (data) => {
  renderResult(data);
});

socket.on('disconnect', () => {
  screenRoot.innerHTML = '<p class="error-text">Se perdió la conexión con el servidor.</p>';
});

function showRoomBadge(codigo) {
  roomBadge.style.display = '';
  roomCodeEl.textContent = codigo;
}

function emptyGrid() {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(null));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---------- Pantalla: entrada ----------

function renderEntrada() {
  screenRoot.innerHTML = `
    <div class="lobby-card">
      <h2 class="final-title" style="font-size:1.3rem">HUNDIR LA FLOTA</h2>
      <p class="final-sub">Creá una sala nueva o unite con un código (son partidas de 2)</p>

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
  const alcanza = currentRoom.jugadores.length === 2;

  screenRoot.innerHTML = `
    <div class="lobby-card">
      <div class="room-code-display">${currentRoom.codigo}</div>
      <p class="final-sub">Compartí este código (partidas de exactamente 2 jugadores)</p>
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

// ---------- Pantalla: juego ----------

function nombreDe(id) {
  const j = currentRoom.jugadores.find((x) => x.id === id);
  return j ? j.nombre : '???';
}

function renderGame() {
  const esMiTurno = turnId === myId;

  screenRoot.innerHTML = `
    <div class="round-info" style="text-align:center;margin-bottom:14px">
      <span class="score-tag turn">${esMiTurno ? 'Tu turno' : `Turno de ${escapeHtml(nombreDe(turnId))}`}</span>
    </div>
    <div class="boards-row">
      <div class="board-col">
        <span class="board-label enemy">Tablero enemigo ${esMiTurno ? '(disparale)' : ''}</span>
        <div id="enemyBoard" class="board"></div>
      </div>
      <div class="board-col">
        <span class="board-label mine">Tu flota</span>
        <div id="myBoard" class="board"></div>
      </div>
    </div>
  `;

  const enemyBoardEl = document.getElementById('enemyBoard');
  const myBoardEl = document.getElementById('myBoard');

  buildBoard(enemyBoardEl, esMiTurno ? (r, c) => disparar(r, c) : null);
  buildBoard(myBoardEl, null);

  updateBoardCells(enemyBoardEl, null, firedByMe, false, esMiTurno);
  updateBoardCells(myBoardEl, myFleetGrid, firedOnMe, true, false);
}

function disparar(r, c) {
  if (turnId !== myId) return;
  if (firedByMe[r][c]) return;
  socket.emit('disparar', { r, c });
}

function buildBoard(boardEl, onCellClick) {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (onCellClick) cell.addEventListener('click', () => onCellClick(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function updateBoardCells(boardEl, fleetGrid, fired, showShips, clickableWhenEmpty) {
  const cells = boardEl.children;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const idx = r * SIZE + c;
      const cellEl = cells[idx];
      const shot = fired[r][c];
      const hasShip = showShips && fleetGrid && fleetGrid[r][c] !== null;

      let cls = 'cell';
      if (!shot && hasShip) cls += ' ship';
      else if (!shot) cls += ' water';
      if (!shot && clickableWhenEmpty) cls += ' clickable';

      if (shot === 'miss') cls += ' miss';
      else if (shot === 'hit') cls += ' hit';
      else if (shot === 'sunk') cls += ' sunk';

      cellEl.className = cls;
      cellEl.textContent = shot === 'miss' ? '·' : shot === 'hit' || shot === 'sunk' ? '✕' : '';
    }
  }
}

// ---------- Pantalla: resultado ----------

function renderResult(data) {
  const gane = data.ganador === myId;
  const motivoTxt = data.motivo === 'abandono' ? ' (el otro jugador se desconectó)' : '';

  screenRoot.innerHTML = `
    <div class="final-card">
      <div class="overlay-title ${gane ? 'win' : 'lose'}" style="font-size:1.4rem">
        ${gane ? 'GANASTE' : 'PERDISTE'}${motivoTxt}
      </div>
      <p class="final-sub" style="margin-top:16px">Volviendo al lobby...</p>
    </div>
  `;
}

renderEntrada();
