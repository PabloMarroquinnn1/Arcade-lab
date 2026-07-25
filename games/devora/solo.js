const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const bestScoreEl = document.getElementById('bestScore');

const WORLD_SIZE = 500;
const TIME_LIMIT_S = 90;
const PELLET_COUNT = 30;
const PELLET_RADIUS = 5;
const HAZARD_COUNT = 5;
const START_MASS = 20;
const PELLET_MASS_GAIN = 3;
const HAZARD_EAT_BONUS = 40;
const HAZARD_SIZE_ADVANTAGE = 1.15; // hay que ser 15% mas grande para comerse a un peligro
const BEST_SCORE_KEY = 'arcade-lab:devora:mejor-tamano';

canvas.width = WORLD_SIZE;
canvas.height = WORLD_SIZE;

let bestScore = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
bestScoreEl.textContent = String(bestScore);

function radiusFor(mass) {
  return 10 + Math.sqrt(mass) * 2.2;
}

function speedFor(mass) {
  return Math.max(1.2, 4.5 - radiusFor(mass) * 0.03);
}

function randomPos(marginR) {
  return {
    x: marginR + Math.random() * (WORLD_SIZE - marginR * 2),
    y: marginR + Math.random() * (WORLD_SIZE - marginR * 2),
  };
}

let player, pellets, hazards, pointerTarget, status, startedAt, lastFrameAt;

function spawnPellet() {
  return { ...randomPos(PELLET_RADIUS), r: PELLET_RADIUS };
}

function spawnHazard() {
  const mass = 60 + Math.random() * 150;
  const safeZone = 130; // no aparece pegado al centro, donde arranca el jugador
  let pos;
  let attempts = 0;
  do {
    pos = randomPos(radiusFor(mass));
    attempts++;
  } while (dist(pos.x, pos.y, WORLD_SIZE / 2, WORLD_SIZE / 2) < safeZone && attempts < 20);
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.6 + Math.random() * 0.8;
  return {
    x: pos.x,
    y: pos.y,
    mass,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

function resetGame() {
  player = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, mass: START_MASS };
  pointerTarget = { x: player.x, y: player.y };
  pellets = Array.from({ length: PELLET_COUNT }, spawnPellet);
  hazards = Array.from({ length: HAZARD_COUNT }, spawnHazard);
  status = 'playing';
  startedAt = performance.now();
  lastFrameAt = startedAt;
  scoreEl.textContent = Math.round(player.mass);
  timerEl.textContent = String(TIME_LIMIT_S);
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function updateHazard(hazard, dt) {
  hazard.x += hazard.vx * dt;
  hazard.y += hazard.vy * dt;
  const r = radiusFor(hazard.mass);
  if (hazard.x - r < 0 || hazard.x + r > WORLD_SIZE) hazard.vx *= -1;
  if (hazard.y - r < 0 || hazard.y + r > WORLD_SIZE) hazard.vy *= -1;
  hazard.x = Math.max(r, Math.min(WORLD_SIZE - r, hazard.x));
  hazard.y = Math.max(r, Math.min(WORLD_SIZE - r, hazard.y));
}

function tick(now) {
  if (status !== 'playing') return;
  const dt = Math.min(2, (now - lastFrameAt) / 16.67); // normalizado a "frames de 60fps"
  lastFrameAt = now;

  const elapsedS = (now - startedAt) / 1000;
  const timeLeft = Math.max(0, TIME_LIMIT_S - elapsedS);
  timerEl.textContent = String(Math.ceil(timeLeft));
  if (timeLeft <= 0) return gameOver('tiempo');

  // Mover al jugador hacia el puntero
  const dx = pointerTarget.x - player.x;
  const dy = pointerTarget.y - player.y;
  const distToTarget = Math.hypot(dx, dy);
  const step = speedFor(player.mass) * dt;
  if (distToTarget > step) {
    player.x += (dx / distToTarget) * step;
    player.y += (dy / distToTarget) * step;
  } else {
    player.x = pointerTarget.x;
    player.y = pointerTarget.y;
  }
  const playerR = radiusFor(player.mass);
  player.x = Math.max(playerR, Math.min(WORLD_SIZE - playerR, player.x));
  player.y = Math.max(playerR, Math.min(WORLD_SIZE - playerR, player.y));

  // Comer pellets
  for (let i = 0; i < pellets.length; i++) {
    const p = pellets[i];
    if (dist(player.x, player.y, p.x, p.y) < playerR + p.r * 0.3) {
      player.mass += PELLET_MASS_GAIN;
      pellets[i] = spawnPellet();
    }
  }

  // Interactuar con peligros
  for (let i = 0; i < hazards.length; i++) {
    const h = hazards[i];
    updateHazard(h, dt);
    const hazardR = radiusFor(h.mass);
    if (dist(player.x, player.y, h.x, h.y) < playerR * 0.5 + hazardR * 0.5) {
      if (player.mass > h.mass * HAZARD_SIZE_ADVANTAGE) {
        player.mass += HAZARD_EAT_BONUS;
        hazards[i] = spawnHazard();
      } else if (h.mass > player.mass * HAZARD_SIZE_ADVANTAGE) {
        return gameOver('comido');
      }
      // si son parecidos en tamano, se rozan y no pasa nada (evita muertes injustas)
    }
  }

  scoreEl.textContent = Math.round(player.mass);
  draw();
  requestAnimationFrame(tick);
}

function gameOver(motivo) {
  status = 'gameover';
  const finalScore = Math.round(player.mass);
  if (finalScore > bestScore) {
    bestScore = finalScore;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
    bestScoreEl.textContent = String(bestScore);
  }
  draw();
  drawOverlay();
  if (motivo === 'tiempo') {
    drawCenteredText('SOBREVIVISTE', canvas.height / 2 - 20, 16, '#00ff88', 18);
  } else {
    drawCenteredText('TE COMIERON', canvas.height / 2 - 20, 16, '#ff4466', 18);
  }
  drawCenteredText(`tamaño final: ${finalScore}`, canvas.height / 2 + 16, 9, '#ffffff', 0);
  drawCenteredText('toca o click para reiniciar', canvas.height / 2 + 40, 6, '#8a8aa0', 0);
}

// ---------- Controles: Pointer Events (mouse, dedo o lapiz) ----------

function toCanvasXY(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * WORLD_SIZE,
    y: ((e.clientY - rect.top) / rect.height) * WORLD_SIZE,
  };
}

canvas.addEventListener('pointermove', (e) => {
  pointerTarget = toCanvasXY(e);
});

canvas.addEventListener('pointerdown', (e) => {
  if (status === 'gameover') {
    resetGame();
    requestAnimationFrame(tick);
    return;
  }
  pointerTarget = toCanvasXY(e);
});

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

function drawOverlay() {
  ctx.fillStyle = 'rgba(5, 5, 12, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function draw() {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const p of pellets) drawCircle(p.x, p.y, p.r, '#ffcc00');

  for (const h of hazards) {
    const hazardR = radiusFor(h.mass);
    const dangerous = h.mass > player.mass * HAZARD_SIZE_ADVANTAGE;
    drawCircle(h.x, h.y, hazardR, dangerous ? '#ff4466' : 'rgba(255, 68, 102, 0.35)', dangerous ? 10 : 0);
  }

  const playerR = radiusFor(player.mass);
  drawCircle(player.x, player.y, playerR, '#00ff88', 14);
}

resetGame();
requestAnimationFrame(tick);
