const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highscoreEl = document.getElementById('highscore');

const GRID_COLS = 32;
const GRID_ROWS = 20;
const CELL = 25;
const TICK_MS = 120;
const START_LENGTH = 3;
const HIGHSCORE_KEY = 'arcade-lab:snake:highscore';

canvas.width = GRID_COLS * CELL;
canvas.height = GRID_ROWS * CELL;

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function isOpposite(a, b) {
  return a.x === -b.x && a.y === -b.y;
}

let snake, direction, nextDirection, food, score, status;

// docs/aprende/09-localstorage.md: el record es local a este navegador,
// no un ranking compartido (eso llegaria con un backend + base de datos).
let highscore = Number(localStorage.getItem(HIGHSCORE_KEY)) || 0;
highscoreEl.textContent = highscore;

function randomFood(occupied) {
  let cell;
  let attempts = 0;
  do {
    cell = { x: Math.floor(Math.random() * GRID_COLS), y: Math.floor(Math.random() * GRID_ROWS) };
    attempts++;
  } while (occupied.some((seg) => seg.x === cell.x && seg.y === cell.y) && attempts < 200);
  return cell;
}

function resetGame() {
  const startX = Math.floor(GRID_COLS / 2);
  const startY = Math.floor(GRID_ROWS / 2);
  direction = DIRECTIONS.right;
  nextDirection = DIRECTIONS.right;
  snake = [];
  for (let i = 0; i < START_LENGTH; i++) {
    snake.push({ x: startX - i, y: startY });
  }
  food = randomFood(snake);
  score = 0;
  status = 'playing';
  scoreEl.textContent = score;
}

function gameOver() {
  status = 'gameover';
  if (score > highscore) {
    highscore = score;
    localStorage.setItem(HIGHSCORE_KEY, String(highscore));
    highscoreEl.textContent = highscore;
  }
}

function tick() {
  if (status !== 'playing') return;

  if (!isOpposite(nextDirection, direction)) {
    direction = nextDirection;
  }

  const head = snake[0];
  const newHead = { x: head.x + direction.x, y: head.y + direction.y };

  if (newHead.x < 0 || newHead.x >= GRID_COLS || newHead.y < 0 || newHead.y >= GRID_ROWS) {
    return gameOver();
  }

  const willGrow = newHead.x === food.x && newHead.y === food.y;
  // Si no crece, la cola se va a mover (vacía esa celda), asi que no cuenta como choque.
  const bodyToCheck = willGrow ? snake : snake.slice(0, -1);
  if (bodyToCheck.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
    return gameOver();
  }

  snake.unshift(newHead);
  if (willGrow) {
    score++;
    scoreEl.textContent = score;
    food = randomFood(snake);
  } else {
    snake.pop();
  }
}

resetGame();
setInterval(tick, TICK_MS);

// ---------- Controles ----------

document.addEventListener('keydown', (e) => {
  if (status === 'gameover') {
    resetGame();
    return;
  }
  const key = e.key;
  if (key === 'w' || key === 'W' || key === 'ArrowUp') nextDirection = DIRECTIONS.up;
  else if (key === 's' || key === 'S' || key === 'ArrowDown') nextDirection = DIRECTIONS.down;
  else if (key === 'a' || key === 'A' || key === 'ArrowLeft') nextDirection = DIRECTIONS.left;
  else if (key === 'd' || key === 'D' || key === 'ArrowRight') nextDirection = DIRECTIONS.right;
  else return;
  e.preventDefault();
});

canvas.addEventListener('click', () => {
  if (status === 'gameover') resetGame();
});

// ---------- Dibujo ----------

function drawBoard() {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSnake() {
  snake.forEach((seg, i) => {
    ctx.save();
    if (i === 0) {
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, 5);
    ctx.fill();
    ctx.restore();
  });
}

function drawFood() {
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

function drawOverlay() {
  ctx.fillStyle = 'rgba(5, 5, 12, 0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function draw() {
  drawBoard();
  drawFood();
  drawSnake();

  if (status === 'gameover') {
    drawOverlay();
    drawCenteredText('GAME OVER', canvas.height / 2 - 20, 20, '#ff4466', 22);
    drawCenteredText(`puntaje: ${score}`, canvas.height / 2 + 20, 10, '#ffffff', 0);
    drawCenteredText('toca o presiona una tecla para reiniciar', canvas.height / 2 + 46, 7, '#8a8aa0', 0);
  }

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
