const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const highscoreEl = document.getElementById('highscore');

const COLS = 10;
const ROWS = 20;
const CELL = 28;
const HIGHSCORE_KEY = 'arcade-lab:cascada:highscore';

canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

// Piezas propias (7 formas, como cualquier juego de bloques que caen) con
// nuestra propia paleta de colores — la mecanica es de dominio publico, el
// estilo visual es nuestro. Ver docs/aprende sobre por que esto importa.
const PIECES = {
  I: { color: '#00ff88', shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
  O: { color: '#ffcc00', shape: [[0,0,0,0],[0,1,1,0],[0,1,1,0],[0,0,0,0]] },
  T: { color: '#ff4466', shape: [[0,0,0,0],[0,1,0,0],[1,1,1,0],[0,0,0,0]] },
  S: { color: '#00ccff', shape: [[0,0,0,0],[0,1,1,0],[1,1,0,0],[0,0,0,0]] },
  Z: { color: '#aa66ff', shape: [[0,0,0,0],[1,1,0,0],[0,1,1,0],[0,0,0,0]] },
  J: { color: '#4477ff', shape: [[0,0,0,0],[1,0,0,0],[1,1,1,0],[0,0,0,0]] },
  L: { color: '#ff9933', shape: [[0,0,0,0],[0,0,1,0],[1,1,1,0],[0,0,0,0]] },
};
const PIECE_TYPES = Object.keys(PIECES);

function randomType() {
  return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
}

// Rotacion simple (sin wall-kick): si al rotar no entra, no rota. Mas facil
// de entender y de mantener sin bugs que un sistema de rotacion "de verdad".
function rotateMatrix(matrix) {
  const n = matrix.length;
  const result = [];
  for (let y = 0; y < n; y++) {
    result.push([]);
    for (let x = 0; x < n; x++) {
      result[y][x] = matrix[n - 1 - x][y];
    }
  }
  return result;
}

function isValidPosition(shape, x, y, grid) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const gx = x + c;
      const gy = y + r;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return false;
      if (gy >= 0 && grid[gy][gx]) return false;
    }
  }
  return true;
}

let grid, current, nextType, score, level, linesCleared, status, gravityInterval;

let highscore = Number(localStorage.getItem(HIGHSCORE_KEY)) || 0;
highscoreEl.textContent = highscore;

function emptyGrid() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
}

function spawnPiece() {
  const type = nextType;
  nextType = randomType();
  current = {
    shape: PIECES[type].shape.map((row) => row.slice()),
    color: PIECES[type].color,
    x: Math.floor((COLS - 4) / 2),
    y: 0,
  };
  drawNextPreview();
}

function currentTickMs() {
  return Math.max(120, 800 - (level - 1) * 60);
}

function restartGravity() {
  if (gravityInterval) clearInterval(gravityInterval);
  gravityInterval = setInterval(tick, currentTickMs());
}

function resetGame() {
  grid = emptyGrid();
  score = 0;
  level = 1;
  linesCleared = 0;
  status = 'playing';
  nextType = randomType();
  spawnPiece();
  scoreEl.textContent = score;
  levelEl.textContent = level;
  restartGravity();
}

function tryMove(dx, dy) {
  const newX = current.x + dx;
  const newY = current.y + dy;
  if (isValidPosition(current.shape, newX, newY, grid)) {
    current.x = newX;
    current.y = newY;
    return true;
  }
  return false;
}

function tryRotate() {
  const rotated = rotateMatrix(current.shape);
  if (isValidPosition(rotated, current.x, current.y, grid)) {
    current.shape = rotated;
  }
}

function hardDrop() {
  while (tryMove(0, 1)) { /* sigue cayendo */ }
  lockPiece();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (grid[r].every((cell) => cell !== null)) {
      grid.splice(r, 1);
      grid.unshift(new Array(COLS).fill(null));
      cleared++;
      r++; // la fila que bajo a esta posicion todavia no se reviso
    }
  }
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800][cleared] || 800;
    score += points;
    linesCleared += cleared;
    const newLevel = Math.floor(linesCleared / 10) + 1;
    if (newLevel !== level) {
      level = newLevel;
      restartGravity();
    }
    scoreEl.textContent = score;
    levelEl.textContent = level;
  }
}

function lockPiece() {
  const { shape, x, y, color } = current;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] && y + r >= 0) grid[y + r][x + c] = color;
    }
  }
  clearLines();
  spawnPiece();
  if (!isValidPosition(current.shape, current.x, current.y, grid)) {
    gameOver();
  }
}

function gameOver() {
  status = 'gameover';
  clearInterval(gravityInterval);
  if (score > highscore) {
    highscore = score;
    localStorage.setItem(HIGHSCORE_KEY, String(highscore));
    highscoreEl.textContent = highscore;
  }
}

function tick() {
  if (status !== 'playing') return;
  if (!tryMove(0, 1)) lockPiece();
}

resetGame();

// ---------- Controles ----------

document.addEventListener('keydown', (e) => {
  if (status === 'gameover') {
    if (e.key === 'Enter' || e.key === ' ') resetGame();
    return;
  }
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': tryMove(-1, 0); break;
    case 'ArrowRight': case 'd': case 'D': tryMove(1, 0); break;
    case 'ArrowDown': case 's': case 'S': if (!tryMove(0, 1)) lockPiece(); break;
    case 'ArrowUp': case 'w': case 'W': tryRotate(); break;
    case ' ': hardDrop(); break;
    default: return;
  }
  e.preventDefault();
});

canvas.addEventListener('click', () => {
  if (status === 'gameover') resetGame();
});

// ---------- Dibujo ----------

function drawCell(x, y, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2, 4);
  ctx.fill();
  ctx.restore();
}

function drawBoard() {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c]) drawCell(c, r, grid[r][c]);
    }
  }

  if (status === 'playing') {
    const { shape, x, y, color } = current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) drawCell(x + c, y + r, color);
      }
    }
  }
}

function drawNextPreview() {
  nextCtx.fillStyle = '#0d0d1a';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = PIECES[nextType].shape;
  const color = PIECES[nextType].color;
  const previewCell = 18;
  nextCtx.fillStyle = color;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        nextCtx.fillRect(c * previewCell + 4, r * previewCell + 4, previewCell - 4, previewCell - 4);
      }
    }
  }
}

function drawCenteredText(text, y, size, color, blur = 14) {
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
  drawBoard();

  if (status === 'gameover') {
    drawOverlay();
    drawCenteredText('GAME OVER', canvas.height / 2 - 30, 16, '#ff4466', 18);
    drawCenteredText(`puntaje: ${score}`, canvas.height / 2 + 10, 9, '#ffffff', 0);
    drawCenteredText('toca o Enter para reiniciar', canvas.height / 2 + 34, 6, '#8a8aa0', 0);
  }

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
