const socket = io('/devora', { transports: ['websocket'] });

const entryScreen = document.getElementById('entryScreen');
const gameWrap = document.getElementById('gameWrap');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const leaderboardEl = document.getElementById('leaderboard');
const nombreInput = document.getElementById('nombreInput');
const entrarBtn = document.getElementById('entrarBtn');

const WORLD_SIZE = 500;
canvas.width = WORLD_SIZE;
canvas.height = WORLD_SIZE;

let myId = null;
let latestState = null;
let lastMoveSentAt = 0;

function radiusFor(mass) {
  return 10 + Math.sqrt(mass) * 2.2;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

socket.on('unido', ({ id }) => {
  myId = id;
  entryScreen.style.display = 'none';
  gameWrap.style.display = 'block';
  requestAnimationFrame(draw);
});

socket.on('gameState', (state) => {
  latestState = state;
});

entrarBtn.addEventListener('click', unirse);
nombreInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unirse();
});

function unirse() {
  const nombre = nombreInput.value.trim() || 'Jugador';
  socket.emit('unirse', { nombre });
}

// ---------- Controles: Pointer Events (mouse, dedo o lapiz) ----------

function toCanvasXY(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * WORLD_SIZE,
    y: ((e.clientY - rect.top) / rect.height) * WORLD_SIZE,
  };
}

function sendMove(e) {
  if (!myId) return;
  const now = performance.now();
  if (now - lastMoveSentAt < 40) return; // no mas de ~25 mensajes por segundo
  lastMoveSentAt = now;
  const { x, y } = toCanvasXY(e);
  socket.emit('mover', { x, y });
}

canvas.addEventListener('pointermove', sendMove);
canvas.addEventListener('pointerdown', sendMove);

// ---------- Dibujo ----------

function drawCircle(x, y, r, color, glow = 0) {
  ctx.save();
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
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

function updateLeaderboard(jugadores) {
  const top = jugadores
    .slice()
    .sort((a, b) => b.mass - a.mass)
    .slice(0, 5);
  leaderboardEl.innerHTML =
    '<div class="leaderboard-title">TOP 5</div>' +
    top
      .map(
        (j) =>
          `<div class="leaderboard-item${j.id === myId ? ' me' : ''}">` +
          `<span>${escapeHtml(j.nombre)}</span><span>${Math.round(j.mass)}</span></div>`
      )
      .join('');
}

function draw() {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!latestState) {
    drawCenteredText('CONECTANDO...', canvas.height / 2, 16, '#00ff88');
    requestAnimationFrame(draw);
    return;
  }

  const { jugadores, pellets } = latestState;

  for (const p of pellets) drawCircle(p.x, p.y, p.r, '#ffcc00');

  let me = null;
  for (const j of jugadores) {
    if (!j.alive) continue;
    if (j.id === myId) {
      me = j;
      continue; // se dibuja al final, arriba de todos los demas
    }
    const r = radiusFor(j.mass);
    drawCircle(j.x, j.y, r, j.color);
    drawCenteredNameAt(j.nombre, j.x, j.y, r);
  }

  if (me) {
    const r = radiusFor(me.mass);
    drawCircle(me.x, me.y, r, me.color, 16);
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(me.x, me.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawCenteredNameAt(me.nombre, me.x, me.y, r);
    scoreEl.textContent = String(Math.round(me.mass));
  } else {
    const mine = jugadores.find((j) => j.id === myId);
    if (mine && !mine.alive) {
      drawCenteredText('TE COMIERON', canvas.height / 2 - 10, 14, '#ff4466', 16);
      drawCenteredText('revivís en un momento...', canvas.height / 2 + 20, 7, '#8a8aa0', 0);
    }
  }

  updateLeaderboard(jugadores);
  requestAnimationFrame(draw);
}

function drawCenteredNameAt(nombre, x, y, r) {
  ctx.save();
  ctx.font = '8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(nombre, x, y - r - 6);
  ctx.restore();
}
