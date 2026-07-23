const socket = io('/cascada', { transports: ['websocket'] });

const canvasP1 = document.getElementById('board-p1');
const canvasP2 = document.getElementById('board-p2');
const ctxP1 = canvasP1.getContext('2d');
const ctxP2 = canvasP2.getContext('2d');
const roleBadge = document.getElementById('role-badge');
const spectatorsEl = document.getElementById('spectators');
const scoreP1El = document.getElementById('score-p1');
const scoreP2El = document.getElementById('score-p2');

const COLS = 10;
const ROWS = 20;
const CELL = 20;

canvasP1.width = canvasP2.width = COLS * CELL;
canvasP1.height = canvasP2.height = ROWS * CELL;

let currentRole = null;
let latestState = null;

const roleLabels = {
  player1: 'JUGADOR 1',
  player2: 'JUGADOR 2',
  spectator: 'ESPECTADOR',
};

socket.on('role', ({ role, spectators }) => {
  currentRole = role;
  roleBadge.textContent = roleLabels[role] || role;
  roleBadge.className = 'badge' + (role === 'player1' ? ' p1' : role === 'player2' ? ' p2' : '');
  spectatorsEl.textContent = spectators > 0 ? `Espectadores: ${spectators}` : '';
});

socket.on('gameState', (state) => {
  latestState = state;
});

socket.on('disconnect', () => {
  roleBadge.textContent = 'DESCONECTADO';
  roleBadge.className = 'badge';
});

// ---------- Controles ----------
// Igual que en Snake: cada tecla es una accion puntual (mover/rotar/bajar),
// no un "se mueve mientras se mantiene apretado" como en Pong.

function sendAction(type) {
  socket.emit('action', { type });
}

document.addEventListener('keydown', (e) => {
  if (currentRole !== 'player1' && currentRole !== 'player2') return;

  if (e.key === ' ') {
    sendAction('hardDrop');
    e.preventDefault();
    return;
  }

  const p1Keys = { a: 'left', A: 'left', d: 'right', D: 'right', s: 'softDrop', S: 'softDrop', w: 'rotate', W: 'rotate' };
  const p2Keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'softDrop', ArrowUp: 'rotate' };
  const map = currentRole === 'player1' ? p1Keys : p2Keys;
  const action = map[e.key];
  if (action) {
    sendAction(action);
    e.preventDefault();
  }
});

// ---------- Dibujo ----------

function drawCell(ctx, x, y, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2, 3);
  ctx.fill();
  ctx.restore();
}

function drawCenteredText(ctx, canvas, text, y, size, color, blur = 10) {
  ctx.save();
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, y);
  ctx.restore();
}

function drawBoard(ctx, canvas, pState) {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!pState) return;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (pState.grid[r][c]) drawCell(ctx, c, r, pState.grid[r][c]);
    }
  }

  if (pState.alive && pState.current) {
    const { shape, x, y, color } = pState.current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) drawCell(ctx, x + c, y + r, color);
      }
    }
  }

  if (!pState.alive) {
    ctx.fillStyle = 'rgba(5, 5, 12, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function draw() {
  if (!latestState) {
    drawBoard(ctxP1, canvasP1, null);
    drawBoard(ctxP2, canvasP2, null);
    drawCenteredText(ctxP1, canvasP1, 'CONECTANDO', canvasP1.height / 2, 9, '#00ff88');
    drawCenteredText(ctxP2, canvasP2, '...', canvasP2.height / 2, 9, '#00ff88');
    requestAnimationFrame(draw);
    return;
  }

  const { p1, p2, status } = latestState;

  drawBoard(ctxP1, canvasP1, p1);
  drawBoard(ctxP2, canvasP2, p2);

  scoreP1El.textContent = p1.score;
  scoreP2El.textContent = p2.score;

  if (status === 'waiting') {
    drawCenteredText(ctxP1, canvasP1, 'ESPERANDO', canvasP1.height / 2, 8, '#ffcc00');
    drawCenteredText(ctxP2, canvasP2, 'RIVAL...', canvasP2.height / 2, 8, '#ffcc00');
  } else if (status === 'countdown') {
    if (latestState.countdown > 0) {
      const text = String(latestState.countdown);
      drawCenteredText(ctxP1, canvasP1, text, canvasP1.height / 2, 26, '#ffffff', 16);
      drawCenteredText(ctxP2, canvasP2, text, canvasP2.height / 2, 26, '#ffffff', 16);
    }
  } else if (status === 'gameover') {
    const winner = latestState.winner;
    const winColor = winner === 'p1' ? '#00ff88' : winner === 'p2' ? '#ff4466' : '#ffcc00';
    const winText = winner === 'p1' ? 'GANA P1' : winner === 'p2' ? 'GANA P2' : 'EMPATE';
    drawCenteredText(ctxP1, canvasP1, winText, canvasP1.height / 2 - 10, 10, winColor, 12);
    drawCenteredText(ctxP2, canvasP2, winText, canvasP2.height / 2 - 10, 10, winColor, 12);
    drawCenteredText(ctxP1, canvasP1, `${latestState.restartIn}s`, canvasP1.height / 2 + 16, 7, '#8a8aa0', 0);
    drawCenteredText(ctxP2, canvasP2, `${latestState.restartIn}s`, canvasP2.height / 2 + 16, 7, '#8a8aa0', 0);
  }

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
