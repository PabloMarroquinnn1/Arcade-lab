const socket = io('/buscaminas', { transports: ['websocket'] });

const boardEl = document.getElementById('board');
const boardWrapEl = document.getElementById('boardWrap');
const minesLeftEl = document.getElementById('minesLeft');
const playersEl = document.getElementById('players');
const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlaySubEl = document.getElementById('overlaySub');
const flagModeBtn = document.getElementById('flagModeBtn');

const COLS = 16;
const ROWS = 16;

let cellEls = [];
let flagMode = false;
let myColor = '#00ff88';
const remoteCursors = {}; // id -> { el }

buildBoardDom();

socket.on('welcome', ({ color }) => {
  myColor = color;
});

socket.on('players', ({ count }) => {
  playersEl.textContent = String(count);
});

socket.on('gameState', (state) => {
  render(state);
});

socket.on('cursor', ({ id, color, x, y }) => {
  let cursor = remoteCursors[id];
  if (!cursor) {
    const el = document.createElement('div');
    el.className = 'remote-cursor';
    el.style.background = color;
    boardWrapEl.appendChild(el);
    cursor = { el };
    remoteCursors[id] = cursor;
  }
  cursor.el.style.left = `${x * 100}%`;
  cursor.el.style.top = `${y * 100}%`;
});

socket.on('playerLeft', ({ id }) => {
  const cursor = remoteCursors[id];
  if (cursor) {
    cursor.el.remove();
    delete remoteCursors[id];
  }
});

socket.on('disconnect', () => {
  playersEl.textContent = '0';
});

// ---------- Tablero ----------

function buildBoardDom() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${COLS}, 28px)`;
  cellEls = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const el = document.createElement('div');
      el.className = 'cell hidden';
      el.addEventListener('click', () => onCellClick(r, c));
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        socket.emit('flag', { r, c });
      });
      boardEl.appendChild(el);
      row.push(el);
    }
    cellEls.push(row);
  }
}

function onCellClick(r, c) {
  if (flagMode) {
    socket.emit('flag', { r, c });
  } else {
    socket.emit('reveal', { r, c });
  }
}

function render(state) {
  minesLeftEl.textContent = String(state.minesLeft);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      renderCell(cellEls[r][c], state.board[r][c]);
    }
  }

  if (state.status === 'won') {
    showOverlay('win', 'GANARON', `Nueva partida en ${state.restartIn}s`);
  } else if (state.status === 'lost') {
    showOverlay('lose', 'BOOM', `Nueva partida en ${state.restartIn}s`);
  } else {
    overlayEl.classList.remove('visible');
  }
}

function renderCell(el, cell) {
  el.className = 'cell';
  el.textContent = '';

  if (cell.flagged) {
    el.classList.add('flagged');
    el.textContent = '🚩';
  } else if (!cell.revealed) {
    el.classList.add('hidden');
  } else if (cell.mine) {
    el.classList.add('mine');
    el.textContent = '💣';
  } else if (cell.adjacent > 0) {
    el.classList.add('revealed', 'n' + cell.adjacent);
    el.textContent = String(cell.adjacent);
  } else {
    el.classList.add('revealed');
  }
}

function showOverlay(kind, title, sub) {
  overlayTitleEl.textContent = title;
  overlayTitleEl.className = 'overlay-title ' + kind;
  overlaySubEl.textContent = sub;
  overlayEl.classList.add('visible');
}

// ---------- Modo bandera (tactil) ----------

flagModeBtn.addEventListener('click', () => {
  flagMode = !flagMode;
  flagModeBtn.classList.toggle('active', flagMode);
});

// ---------- Cursor compartido ----------
// Mandamos la posicion como fraccion (0..1) del tablero, no en pixeles, para
// que le sirva a cualquiera sin importar el tamaño de su pantalla.

let lastCursorSentAt = 0;

function sendCursor(clientX, clientY) {
  const now = performance.now();
  if (now - lastCursorSentAt < 60) return; // throttle: max ~16 mensajes/seg
  lastCursorSentAt = now;

  const rect = boardWrapEl.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return;
  socket.emit('cursor', { x, y });
}

boardWrapEl.addEventListener('mousemove', (e) => sendCursor(e.clientX, e.clientY));
boardWrapEl.addEventListener('touchmove', (e) => {
  if (e.touches[0]) sendCursor(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });
