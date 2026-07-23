// Forzar WebSocket evita el transporte inicial por HTTP long-polling,
// que es la causa nº1 de lag en red local con socket.io.
// Namespace '/pong': separa los eventos de este juego de los de otros
// juegos en tiempo real que se agreguen mas adelante en el mismo servidor.
const socket = io('/pong', { transports: ['websocket'] });

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const roleBadge = document.getElementById('role-badge');
const pingValue = document.getElementById('ping-value');
const pingDot = document.getElementById('ping-dot');
const spectatorsEl = document.getElementById('spectators');
const stage = document.getElementById('stage');

const GAME_W = 800;
const GAME_H = 500;
const PADDLE_W = 12;
const PADDLE_H = 90;
const PADDLE_MARGIN = 20;
const BALL_SIZE = 10;

// Renderizamos ~80ms en el pasado, interpolando entre snapshots del servidor.
// Esto absorbe el jitter de la red y hace el movimiento perfectamente fluido.
const INTERP_DELAY_MS = 80;

let currentRole = null;
let latestState = null;
const snapshots = [];

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
  snapshots.push({ t: performance.now(), state });
  while (snapshots.length > 90) snapshots.shift();
});

socket.on('disconnect', () => {
  roleBadge.textContent = 'DESCONECTADO';
  roleBadge.className = 'badge';
  pingDot.className = 'dot bad';
});

// ---------- Latencia ----------

setInterval(() => {
  if (!socket.connected) return;
  const start = performance.now();
  socket.emit('latency', () => {
    const ms = Math.round(performance.now() - start);
    pingValue.textContent = `${ms} ms`;
    pingDot.className = 'dot ' + (ms < 60 ? 'good' : ms < 150 ? 'mid' : 'bad');
  });
}, 2000);

// ---------- Interpolación ----------

function lerp(a, b, k) {
  return a + (b - a) * k;
}

function getRenderState() {
  if (snapshots.length === 0) return null;
  if (snapshots.length === 1) return snapshots[0].state;

  const renderTime = performance.now() - INTERP_DELAY_MS;

  for (let i = snapshots.length - 1; i > 0; i--) {
    const a = snapshots[i - 1];
    const b = snapshots[i];
    if (a.t <= renderTime) {
      const span = b.t - a.t || 1;
      const k = Math.min(Math.max((renderTime - a.t) / span, 0), 1);

      // Si la pelota "teletransportó" (gol / reset), no interpolar el salto.
      const jumped =
        Math.abs(b.state.ball.x - a.state.ball.x) > 120 ||
        Math.abs(b.state.ball.y - a.state.ball.y) > 120;

      return {
        ball: jumped
          ? b.state.ball
          : {
              x: lerp(a.state.ball.x, b.state.ball.x, k),
              y: lerp(a.state.ball.y, b.state.ball.y, k),
            },
        paddles: {
          left: { y: lerp(a.state.paddles.left.y, b.state.paddles.left.y, k) },
          right: { y: lerp(a.state.paddles.right.y, b.state.paddles.right.y, k) },
        },
        score: b.state.score,
        status: b.state.status,
        countdown: b.state.countdown,
        restartIn: b.state.restartIn,
        winner: b.state.winner,
      };
    }
  }
  return latestState;
}

// ---------- Canvas responsive + alta densidad ----------

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  const maxW = rect.width - 12;
  const maxH = rect.height - 12;
  const scale = Math.min(maxW / GAME_W, maxH / GAME_H);

  const displayW = Math.floor(GAME_W * scale);
  const displayH = Math.floor(GAME_H * scale);

  canvas.style.width = `${displayW}px`;
  canvas.style.height = `${displayH}px`;

  // Backing store al tamaño real en píxeles físicos → nitidez en pantallas retina
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(displayW * dpr);
  canvas.height = Math.round(displayH * dpr);

  // Todo el código de dibujo sigue trabajando en coordenadas 800x500
  ctx.setTransform(canvas.width / GAME_W, 0, 0, canvas.height / GAME_H, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 150));
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resizeCanvas);
}
// ResizeObserver detecta cualquier cambio del área disponible (rotación,
// barra de URL que aparece/desaparece, teclado en pantalla, etc.)
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(resizeCanvas).observe(stage);
}
resizeCanvas();

// ---------- Teclado ----------

const keys = {};

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
  if (keys[e.key]) return;
  keys[e.key] = true;
  sendKeyboardDirection();
});

document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
  sendKeyboardDirection();
});

function sendKeyboardDirection() {
  let up = false;
  let down = false;
  if (currentRole === 'player1') {
    up = keys['w'] || keys['W'];
    down = keys['s'] || keys['S'];
  } else if (currentRole === 'player2') {
    up = keys['ArrowUp'];
    down = keys['ArrowDown'];
  } else {
    return;
  }
  socket.emit('movePaddle', { direction: up ? 'up' : down ? 'down' : 'none' });
}

// ---------- Táctil: la paleta sigue el dedo ----------

let touchActive = false;
let lastSentY = null;
let lastSentAt = 0;

function touchToGameY(clientY) {
  const rect = canvas.getBoundingClientRect();
  const y = ((clientY - rect.top) / rect.height) * GAME_H;
  return Math.min(Math.max(y, 0), GAME_H);
}

function sendTargetY(clientY) {
  const now = performance.now();
  const targetY = touchToGameY(clientY);
  // throttle: máx ~1 mensaje cada 30ms y solo si se movió lo suficiente
  if (now - lastSentAt < 30 && lastSentY !== null && Math.abs(targetY - lastSentY) < 4) return;
  lastSentAt = now;
  lastSentY = targetY;
  socket.emit('movePaddle', { targetY });
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (currentRole !== 'player1' && currentRole !== 'player2') return;
  touchActive = true;
  sendTargetY(e.touches[0].clientY);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!touchActive) return;
  sendTargetY(e.touches[0].clientY);
}, { passive: false });

function endTouch(e) {
  e.preventDefault();
  if (e.touches && e.touches.length > 0) return;
  touchActive = false;
  lastSentY = null;
  if (currentRole === 'player1' || currentRole === 'player2') {
    socket.emit('movePaddle', { direction: 'none' });
  }
}

canvas.addEventListener('touchend', endTouch, { passive: false });
canvas.addEventListener('touchcancel', endTouch, { passive: false });

// ---------- Dibujo ----------

const trail = [];
let lastScore = { p1: 0, p2: 0 };
let scoreFlash = { p1: 0, p2: 0 };

function drawBackground() {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  const grad = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, 60, GAME_W / 2, GAME_H / 2, 500);
  grad.addColorStop(0, 'rgba(255,255,255,0.03)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(GAME_W / 2, 10);
  ctx.lineTo(GAME_W / 2, GAME_H - 10);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPaddle(x, y, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, PADDLE_W, PADDLE_H, 6);
  ctx.fill();
  ctx.restore();
}

function drawBall(x, y) {
  // estela
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const alpha = ((i + 1) / trail.length) * 0.35;
    const size = (BALL_SIZE / 2) * ((i + 1) / trail.length);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, BALL_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawScore(score) {
  if (score.p1 !== lastScore.p1) scoreFlash.p1 = 1;
  if (score.p2 !== lastScore.p2) scoreFlash.p2 = 1;
  lastScore = { ...score };

  scoreFlash.p1 = Math.max(0, scoreFlash.p1 - 0.02);
  scoreFlash.p2 = Math.max(0, scoreFlash.p2 - 0.02);

  ctx.save();
  ctx.font = '36px "Press Start 2P", monospace';

  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 12 + scoreFlash.p1 * 30;
  ctx.fillStyle = '#00ff88';
  ctx.textAlign = 'right';
  ctx.fillText(String(score.p1), GAME_W / 2 - 45, 60);

  ctx.shadowColor = '#ff4466';
  ctx.shadowBlur = 12 + scoreFlash.p2 * 30;
  ctx.fillStyle = '#ff4466';
  ctx.textAlign = 'left';
  ctx.fillText(String(score.p2), GAME_W / 2 + 45, 60);
  ctx.restore();
}

function drawCenteredText(text, y, size, color, blur = 16) {
  ctx.save();
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, GAME_W / 2, y);
  ctx.restore();
}

function drawOverlay(alpha = 0.55) {
  ctx.fillStyle = `rgba(5, 5, 12, ${alpha})`;
  ctx.fillRect(0, 0, GAME_W, GAME_H);
}

function draw() {
  drawBackground();

  const state = getRenderState();

  if (!state) {
    drawCenteredText('CONECTANDO...', GAME_H / 2, 16, '#00ff88');
    requestAnimationFrame(draw);
    return;
  }

  const { ball, paddles, score, status } = state;

  drawPaddle(PADDLE_MARGIN, paddles.left.y, '#00ff88');
  drawPaddle(GAME_W - PADDLE_MARGIN - PADDLE_W, paddles.right.y, '#ff4466');

  if (status === 'playing') {
    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 12) trail.shift();
    drawBall(ball.x, ball.y);
  } else {
    trail.length = 0;
  }

  drawScore(score);

  if (status === 'waiting') {
    drawOverlay();
    drawCenteredText('ESPERANDO RIVAL...', GAME_H / 2 - 10, 15, '#ffcc00');
    drawCenteredText('comparte el enlace para jugar', GAME_H / 2 + 30, 9, '#8a8aa0', 0);
  } else if (status === 'countdown') {
    drawOverlay(0.3);
    if (state.countdown > 0) {
      drawCenteredText(String(state.countdown), GAME_H / 2 + 20, 56, '#ffffff', 30);
    }
  } else if (status === 'gameover') {
    drawOverlay(0.7);
    const winColor = state.winner === 'p1' ? '#00ff88' : '#ff4466';
    const winText = state.winner === 'p1' ? 'JUGADOR 1 GANA' : 'JUGADOR 2 GANA';
    drawCenteredText(winText, GAME_H / 2 - 20, 22, winColor, 24);
    drawCenteredText(`nueva partida en ${state.restartIn}...`, GAME_H / 2 + 40, 10, '#8a8aa0', 0);
  }

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
