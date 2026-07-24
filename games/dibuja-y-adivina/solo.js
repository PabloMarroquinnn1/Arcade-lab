const gameCard = document.getElementById('gameCard');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('bestScore');

const ROUND_SIZE = 6;
const DRAW_DURATION_MS = 8000;
const TOTAL_ROUND_MS = 15000; // dibujar + tiempo extra para adivinar con el dibujo ya completo
const NEXT_PAUSE_MS = 1800;
const BEST_SCORE_KEY = 'arcade-lab:dibuja-y-adivina:mejor-puntaje';

let bestScore = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
bestScoreEl.textContent = String(bestScore);

let allDrawings = [];
let rounds = [];
let currentIndex = 0;
let score = 0;
let ctx = null;
let animationFrameId = null;
let roundStartedAt = 0;
let solved = false;
let roundTimeout = null;

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const ACCENTED = { a: 'aàáäâ', e: 'eèéëê', i: 'iìíïî', o: 'oòóöô', u: 'uùúüû', n: 'nñ' };

function normalize(text) {
  let result = text.trim().toLowerCase();
  for (const base of Object.keys(ACCENTED)) {
    for (const variant of ACCENTED[base]) {
      if (variant !== base) result = result.split(variant).join(base);
    }
  }
  return result;
}

async function loadDrawings() {
  const respuesta = await fetch('dibujos.json');
  if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);
  allDrawings = await respuesta.json();
}

function buildSegments(trazos) {
  const segments = [];
  let total = 0;
  for (const stroke of trazos) {
    for (let i = 0; i < stroke.length - 1; i++) {
      const [x1, y1] = stroke[i];
      const [x2, y2] = stroke[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      segments.push({ x1, y1, x2, y2, len, startAt: total });
      total += len;
    }
  }
  return { segments, total: total || 1 };
}

function renderStrokesUpTo(canvas, segments, targetDist) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 6;

  for (const seg of segments) {
    if (seg.startAt >= targetDist) break;
    const segEnd = seg.startAt + seg.len;
    let ex = seg.x2;
    let ey = seg.y2;
    if (segEnd > targetDist) {
      const frac = seg.len === 0 ? 0 : (targetDist - seg.startAt) / seg.len;
      ex = seg.x1 + (seg.x2 - seg.x1) * frac;
      ey = seg.y1 + (seg.y2 - seg.y1) * frac;
    }
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
}

function startGame() {
  score = 0;
  currentIndex = 0;
  scoreEl.textContent = '0';
  rounds = shuffle(allDrawings).slice(0, ROUND_SIZE);
  startRound();
}

function startRound() {
  solved = false;
  roundStartedAt = performance.now();
  const drawing = rounds[currentIndex];
  const { segments, total } = buildSegments(drawing.trazos);

  gameCard.innerHTML = `
    <div class="progress-row">
      <span>Dibujo ${currentIndex + 1} / ${rounds.length}</span>
      <span id="timerLabel">${Math.ceil(TOTAL_ROUND_MS / 1000)}s</span>
    </div>
    <div class="timer-bar-wrap"><div id="timerBar" class="timer-bar" style="width:100%"></div></div>
    <canvas id="drawCanvas" width="300" height="300"></canvas>
    <form class="guess-form" id="guessForm">
      <input id="guessInput" type="text" placeholder="¿Qué es?" autocomplete="off" autofocus />
      <button class="primary-btn" type="submit">Adivinar</button>
    </form>
    <p id="feedback" class="feedback-text"></p>
  `;

  const canvas = document.getElementById('drawCanvas');
  ctx = canvas.getContext('2d');
  const guessForm = document.getElementById('guessForm');
  const guessInput = document.getElementById('guessInput');
  const feedback = document.getElementById('feedback');

  guessForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (solved) return;
    const intento = normalize(guessInput.value);
    if (!intento) return;
    if (intento === normalize(drawing.palabra)) {
      solveRound(feedback);
    } else {
      feedback.textContent = 'No es eso, seguí intentando...';
      feedback.className = 'feedback-text incorrect';
    }
    guessInput.value = '';
    guessInput.focus();
  });

  function tick() {
    const elapsed = performance.now() - roundStartedAt;

    if (elapsed <= DRAW_DURATION_MS) {
      const targetDist = (elapsed / DRAW_DURATION_MS) * total;
      renderStrokesUpTo(canvas, segments, targetDist);
    } else if (animationFrameId !== null) {
      renderStrokesUpTo(canvas, segments, total);
    }

    const timeLeftMs = Math.max(0, TOTAL_ROUND_MS - elapsed);
    const timerBar = document.getElementById('timerBar');
    const timerLabel = document.getElementById('timerLabel');
    if (timerBar && timerLabel) {
      const pct = (timeLeftMs / TOTAL_ROUND_MS) * 100;
      timerBar.style.width = `${pct}%`;
      timerBar.style.backgroundColor = pct < 25 ? '#ff4466' : pct < 55 ? '#ffcc00' : '#00ff88';
      timerLabel.textContent = `${Math.ceil(timeLeftMs / 1000)}s`;
    }

    if (!solved && elapsed >= TOTAL_ROUND_MS) {
      revealAndAdvance(feedback, drawing);
      return;
    }

    if (!solved) {
      animationFrameId = requestAnimationFrame(tick);
    }
  }

  animationFrameId = requestAnimationFrame(tick);
}

function solveRound(feedback) {
  solved = true;
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;

  const elapsed = performance.now() - roundStartedAt;
  const timeLeftMs = Math.max(0, TOTAL_ROUND_MS - elapsed);
  const puntos = 100 + Math.round((timeLeftMs / TOTAL_ROUND_MS) * 100);
  score += puntos;
  scoreEl.textContent = String(score);

  feedback.textContent = `¡Correcto! +${puntos} pts`;
  feedback.className = 'feedback-text correct';

  roundTimeout = setTimeout(nextRound, NEXT_PAUSE_MS);
}

function revealAndAdvance(feedback, drawing) {
  solved = true;
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;

  feedback.textContent = `Se acabó el tiempo. Era: ${drawing.palabra}`;
  feedback.className = 'feedback-text reveal';

  roundTimeout = setTimeout(nextRound, NEXT_PAUSE_MS);
}

function nextRound() {
  currentIndex++;
  if (currentIndex >= rounds.length) {
    renderFinal();
  } else {
    startRound();
  }
}

function renderFinal() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
    bestScoreEl.textContent = String(bestScore);
  }

  gameCard.innerHTML = `
    <div class="final-title">¡TERMINASTE!</div>
    <div class="final-score">${score} pts</div>
    <div class="final-sub">Mejor puntaje: ${bestScore} pts</div>
    <button class="primary-btn" id="retryBtn" type="button">Jugar de nuevo</button>
  `;
  document.getElementById('retryBtn').addEventListener('click', startGame);
}

async function init() {
  gameCard.innerHTML = '<div class="progress-row"><span>Cargando dibujos...</span></div>';
  try {
    await loadDrawings();
    startGame();
  } catch (error) {
    gameCard.innerHTML = `<p class="feedback-text incorrect">No se pudieron cargar los dibujos: ${error.message}</p>`;
  }
}

init();
