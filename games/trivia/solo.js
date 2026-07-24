const quizCard = document.getElementById('quizCard');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('bestScore');

const QUESTIONS_PER_ROUND = 8;
const TIME_PER_QUESTION_S = 15;
const RESULT_PAUSE_MS = 1400;
const BEST_SCORE_KEY = 'arcade-lab:trivia:mejor-puntaje';

let bestScore = Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
bestScoreEl.textContent = String(bestScore);

let questions = [];
let currentIndex = 0;
let score = 0;
let answered = false;
let timeLeftMs = 0;
let tickInterval = null;

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadQuestions() {
  const respuesta = await fetch('preguntas.json');
  if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);
  const todas = await respuesta.json();
  questions = shuffle(todas).slice(0, QUESTIONS_PER_ROUND);
}

function startQuestion() {
  answered = false;
  timeLeftMs = TIME_PER_QUESTION_S * 1000;
  renderQuestion();
  startTimer();
}

function startTimer() {
  clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    timeLeftMs -= 100;
    updateTimerBar();
    if (timeLeftMs <= 0) {
      clearInterval(tickInterval);
      revealAnswer(null);
    }
  }, 100);
}

function updateTimerBar() {
  const bar = document.getElementById('timerBar');
  if (!bar) return;
  const pct = Math.max(0, (timeLeftMs / (TIME_PER_QUESTION_S * 1000)) * 100);
  bar.style.width = `${pct}%`;
  bar.style.backgroundColor = pct < 25 ? '#ff4466' : pct < 55 ? '#ffcc00' : '#00ff88';
}

function selectAnswer(optionIndex) {
  if (answered) return;
  clearInterval(tickInterval);
  revealAnswer(optionIndex);
}

function revealAnswer(optionIndex) {
  answered = true;
  const question = questions[currentIndex];
  const correct = optionIndex === question.correcta;

  if (correct) {
    const fraction = Math.max(0, timeLeftMs) / (TIME_PER_QUESTION_S * 1000);
    const points = 100 + Math.round(fraction * 100);
    score += points;
    scoreEl.textContent = String(score);
  }

  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === question.correcta) btn.classList.add('correct');
    else if (i === optionIndex) btn.classList.add('incorrect');
  });

  setTimeout(nextQuestion, RESULT_PAUSE_MS);
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex >= questions.length) {
    renderFinal();
  } else {
    startQuestion();
  }
}

function renderFinal() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
    bestScoreEl.textContent = String(bestScore);
  }

  quizCard.innerHTML = `
    <div class="final-card">
      <div class="final-title">¡TERMINASTE!</div>
      <div class="final-score">${score} pts</div>
      <div class="final-sub">Mejor puntaje: ${bestScore} pts</div>
      <button class="primary-btn" id="retryBtn" type="button">Jugar de nuevo</button>
    </div>
  `;
  document.getElementById('retryBtn').addEventListener('click', startGame);
}

function renderQuestion() {
  const question = questions[currentIndex];
  quizCard.innerHTML = `
    <div class="progress-row">
      <span>Pregunta ${currentIndex + 1} / ${questions.length}</span>
      <span>${TIME_PER_QUESTION_S}s</span>
    </div>
    <div class="timer-bar-wrap"><div id="timerBar" class="timer-bar" style="width:100%"></div></div>
    <div class="question-text">${question.pregunta}</div>
    <div class="options-grid">
      ${question.opciones.map((op, i) => `<button class="option-btn" data-index="${i}">${op}</button>`).join('')}
    </div>
  `;

  quizCard.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.add('selected');
      selectAnswer(Number(btn.dataset.index));
    });
  });
}

async function startGame() {
  quizCard.innerHTML = '<div class="progress-row"><span>Cargando preguntas...</span></div>';
  score = 0;
  currentIndex = 0;
  scoreEl.textContent = '0';
  try {
    await loadQuestions();
    startQuestion();
  } catch (error) {
    quizCard.innerHTML = `<div class="error-text">No se pudieron cargar las preguntas: ${error.message}</div>`;
  }
}

startGame();
