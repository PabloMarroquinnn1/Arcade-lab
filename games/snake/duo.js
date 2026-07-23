const socket = io('/snake', { transports: ['websocket'] });

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const roleBadge = document.getElementById('role-badge');
const spectatorsEl = document.getElementById('spectators');
const scoreP1El = document.getElementById('score-p1');
const scoreP2El = document.getElementById('score-p2');

const GRID_COLS = 32;
const GRID_ROWS = 20;
const CELL = 25;

canvas.width = GRID_COLS * CELL;
canvas.height = GRID_ROWS * CELL;

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
// A diferencia de Pong (que manda "se mueve / no se mueve" todo el tiempo),
// aca cada tecla es un cambio de direccion puntual, asi que solo mandamos
// un evento por tecla presionada, no en cada frame.

function sendDirection(direction) {
  socket.emit('setDirection', { direction });
}

document.addEventListener('keydown', (e) => {
  if (currentRole === 'player1') {
    if (e.key === 'w' || e.key === 'W') sendDirection('up');
    else if (e.key === 's' || e.key === 'S') sendDirection('down');
    else if (e.key === 'a' || e.key === 'A') sendDirection('left');
    else if (e.key === 'd' || e.key === 'D') sendDirection('right');
  } else if (currentRole === 'player2') {
    if (e.key === 'ArrowUp') sendDirection('up');
    else if (e.key === 'ArrowDown') sendDirection('down');
    else if (e.key === 'ArrowLeft') sendDirection('left');
    else if (e.key === 'ArrowRight') sendDirection('right');
    else return;
    e.preventDefault();
  }
});

// ---------- Dibujo ----------

function drawBoard() {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSnake(segments, color, alive) {
  segments.forEach((seg, i) => {
    ctx.save();
    if (i === 0 && alive) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = alive ? color : 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, 5);
    ctx.fill();
    ctx.restore();
  });
}

function drawFood(food) {
  ctx.save();
  ctx.shadowColor = '#ffcc00';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCenteredText(text, y, size, color, blur = 16) {
  ctx.save();
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, y);
  ctx.restore();
}

function drawOverlay(alpha = 0.55) {
  ctx.fillStyle = `rgba(5, 5, 12, ${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function draw() {
  drawBoard();

  if (!latestState) {
    drawCenteredText('CONECTANDO...', canvas.height / 2, 16, '#00ff88');
    requestAnimationFrame(draw);
    return;
  }

  const { p1, p2, food, status } = latestState;

  drawFood(food);
  drawSnake(p1.segments, '#00ff88', p1.alive);
  drawSnake(p2.segments, '#ff4466', p2.alive);

  scoreP1El.textContent = p1.score;
  scoreP2El.textContent = p2.score;

  if (status === 'waiting') {
    drawOverlay();
    drawCenteredText('ESPERANDO RIVAL...', canvas.height / 2 - 10, 14, '#ffcc00');
    drawCenteredText('comparte el enlace para jugar', canvas.height / 2 + 26, 8, '#8a8aa0', 0);
  } else if (status === 'countdown') {
    drawOverlay(0.3);
    if (latestState.countdown > 0) {
      drawCenteredText(String(latestState.countdown), canvas.height / 2 + 15, 48, '#ffffff', 26);
    }
  } else if (status === 'gameover') {
    drawOverlay(0.7);
    const winner = latestState.winner;
    const winColor = winner === 'p1' ? '#00ff88' : winner === 'p2' ? '#ff4466' : '#ffcc00';
    const winText = winner === 'p1' ? 'JUGADOR 1 GANA' : winner === 'p2' ? 'JUGADOR 2 GANA' : 'EMPATE';
    drawCenteredText(winText, canvas.height / 2 - 15, 18, winColor, 20);
    drawCenteredText(`nueva partida en ${latestState.restartIn}...`, canvas.height / 2 + 30, 8, '#8a8aa0', 0);
  }

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
