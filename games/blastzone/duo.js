const socket = io('/blastzone', { transports: ['websocket'] });

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const roleBadge = document.getElementById('role-badge');
const spectatorsEl = document.getElementById('spectators');
const statusP1El = document.getElementById('status-p1');
const statusP2El = document.getElementById('status-p2');

const COLS = 13;
const ROWS = 11;
const CELL = 32;
const BLAST_RADIUS = 2;

canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

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
// Cada tecla es una accion puntual (moverse un paso / poner bomba), como en
// Snake y Cascada — no "se mueve mientras se mantiene apretado" como Pong.

document.addEventListener('keydown', (e) => {
  if (currentRole !== 'player1' && currentRole !== 'player2') return;

  if (e.key === ' ') {
    socket.emit('placeBomb');
    e.preventDefault();
    return;
  }

  const p1Keys = { w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right' };
  const p2Keys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const map = currentRole === 'player1' ? p1Keys : p2Keys;
  const direction = map[e.key];
  if (direction) {
    socket.emit('move', { direction });
    e.preventDefault();
  }
});

// ---------- Dibujo ----------

function computeBlast(grid, r, c) {
  const cells = [[r, c]];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of dirs) {
    for (let i = 1; i <= BLAST_RADIUS; i++) {
      const nr = r + dr * i;
      const nc = c + dc * i;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
      const cell = grid[nr][nc];
      if (cell.type === 'wall') break;
      cells.push([nr, nc]);
      if (cell.type === 'block') break;
    }
  }
  return cells;
}

function drawBoard(grid) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      ctx.fillStyle = cell.type === 'wall' ? '#1a1a2e' : '#0d0d1a';
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      if (cell.type === 'wall') {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      } else if (cell.type === 'block') {
        ctx.save();
        ctx.fillStyle = '#3a3a55';
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4, 4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

function drawBombs(grid, bombs) {
  const now = Date.now();
  for (const bomb of bombs) {
    if (bomb.exploded) {
      const age = now - bomb.explodedAt;
      const alpha = Math.max(0, 1 - age / 400);
      for (const [r, c] of computeBlast(grid, bomb.r, bomb.c)) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 153, 51, ${alpha * 0.8})`;
        ctx.shadowColor = '#ff9933';
        ctx.shadowBlur = 20;
        ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);
        ctx.restore();
      }
    } else {
      ctx.save();
      ctx.shadowColor = '#ff4466';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff4466';
      ctx.beginPath();
      ctx.arc(bomb.c * CELL + CELL / 2, bomb.r * CELL + CELL / 2, CELL / 2 - 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawPlayer(pState, color) {
  if (!pState.alive) return;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(pState.c * CELL + 5, pState.r * CELL + 5, CELL - 10, CELL - 10, 6);
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
  if (!latestState) {
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawCenteredText('CONECTANDO...', canvas.height / 2, 16, '#00ff88');
    requestAnimationFrame(draw);
    return;
  }

  const { grid, p1, p2, bombs, status } = latestState;

  drawBoard(grid);
  drawBombs(grid, bombs);
  drawPlayer(p1, '#00ff88');
  drawPlayer(p2, '#ff4466');

  statusP1El.textContent = p1.alive ? 'VIVO' : 'ELIMINADO';
  statusP1El.className = 'score-tag p1' + (p1.alive ? '' : ' dead');
  statusP2El.textContent = p2.alive ? 'VIVO' : 'ELIMINADO';
  statusP2El.className = 'score-tag p2' + (p2.alive ? '' : ' dead');

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
