const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const timerEl = document.getElementById('timer');
const bestTimeEl = document.getElementById('bestTime');

const COLS = 13;
const ROWS = 11;
const CELL = 32;
const TIME_LIMIT_S = 120;
const MOVE_COOLDOWN_MS = 150;
const BOMB_FUSE_MS = 2200;
const BLAST_RADIUS = 2;
const MAX_BOMBS = 1;
const BLOCK_CHANCE = 0.7;
const BEST_TIME_KEY = 'arcade-lab:blastzone:mejor-tiempo';

canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

let bestTime = Number(localStorage.getItem(BEST_TIME_KEY)) || null;
bestTimeEl.textContent = bestTime !== null ? `${bestTime}s` : '--';

let grid, player, bombs, exitCell, exitRevealed, status, lastMoveAt, secondsLeft, countdownInterval, startedAt;

function buildArena() {
  const newGrid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      let type = 'empty';
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) type = 'wall';
      else if (r % 2 === 0 && c % 2 === 0) type = 'wall';
      row.push({ type, hasExit: false });
    }
    newGrid.push(row);
  }

  const spawnClear = [[1, 1], [1, 2], [2, 1]];
  const blockCells = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (newGrid[r][c].type === 'wall') continue;
      if (spawnClear.some(([sr, sc]) => sr === r && sc === c)) continue;
      if (Math.random() < BLOCK_CHANCE) {
        newGrid[r][c].type = 'block';
        blockCells.push([r, c]);
      }
    }
  }

  // Guardamos la salida bajo un bloque cualquiera (no vacio), lejos del spawn
  const farBlocks = blockCells.filter(([r, c]) => r + c > 6);
  const pool = farBlocks.length > 0 ? farBlocks : blockCells;
  const [er, ec] = pool[Math.floor(Math.random() * pool.length)];
  newGrid[er][ec].hasExit = true;

  return { grid: newGrid, exitCell: { r: er, c: ec } };
}

function resetGame() {
  const arena = buildArena();
  grid = arena.grid;
  exitCell = arena.exitCell;
  exitRevealed = false;
  player = { r: 1, c: 1 };
  bombs = [];
  status = 'playing';
  lastMoveAt = 0;
  secondsLeft = TIME_LIMIT_S;
  startedAt = performance.now();
  timerEl.textContent = String(secondsLeft);

  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    if (status !== 'playing') return;
    secondsLeft--;
    timerEl.textContent = String(Math.max(0, secondsLeft));
    if (secondsLeft <= 0) loseGame();
  }, 1000);
}

function isWalkable(r, c) {
  const cell = grid[r][c];
  if (cell.type === 'wall' || cell.type === 'block') return false;
  if (bombs.some((b) => !b.exploded && b.r === r && b.c === c)) return false;
  return true;
}

function tryMove(dr, dc) {
  if (status !== 'playing') return;
  const now = performance.now();
  if (now - lastMoveAt < MOVE_COOLDOWN_MS) return;
  const nr = player.r + dr;
  const nc = player.c + dc;
  if (!isWalkable(nr, nc)) return;
  player.r = nr;
  player.c = nc;
  lastMoveAt = now;
  checkExit();
}

function checkExit() {
  if (exitRevealed && player.r === exitCell.r && player.c === exitCell.c) {
    winGame();
  }
}

function placeBomb() {
  if (status !== 'playing') return;
  const activeBombs = bombs.filter((b) => !b.exploded);
  if (activeBombs.length >= MAX_BOMBS) return;
  if (activeBombs.some((b) => b.r === player.r && b.c === player.c)) return;
  bombs.push({ r: player.r, c: player.c, plantedAt: performance.now(), exploded: false, explodedAt: 0 });
}

function computeBlast(r, c) {
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

function explodeBomb(bomb) {
  const queue = [bomb];
  const blastCells = [];

  while (queue.length > 0) {
    const b = queue.pop();
    if (b.exploded) continue;
    b.exploded = true;
    b.explodedAt = performance.now();

    const cells = computeBlast(b.r, b.c);
    blastCells.push(...cells);

    for (const [r, c] of cells) {
      const cell = grid[r][c];
      if (cell.type === 'block') {
        cell.type = 'empty';
        if (cell.hasExit) exitRevealed = true;
      }
      const chained = bombs.find((x) => !x.exploded && x.r === r && x.c === c);
      if (chained) queue.push(chained);
    }
  }

  if (blastCells.some(([r, c]) => r === player.r && c === player.c)) {
    loseGame();
  }
}

function tick() {
  if (status !== 'playing') return;
  const now = performance.now();
  for (const bomb of bombs) {
    if (!bomb.exploded && now - bomb.plantedAt >= BOMB_FUSE_MS) {
      explodeBomb(bomb);
    }
  }
  bombs = bombs.filter((b) => !b.exploded || now - b.explodedAt < 400);
}

function loseGame() {
  if (status !== 'playing') return;
  status = 'lost';
  clearInterval(countdownInterval);
}

function winGame() {
  if (status !== 'playing') return;
  status = 'won';
  clearInterval(countdownInterval);
  const elapsed = Math.round((performance.now() - startedAt) / 1000);
  if (bestTime === null || elapsed < bestTime) {
    bestTime = elapsed;
    localStorage.setItem(BEST_TIME_KEY, String(bestTime));
    bestTimeEl.textContent = `${bestTime}s`;
  }
}

resetGame();
setInterval(tick, 100);

// ---------- Controles ----------

document.addEventListener('keydown', (e) => {
  if (status !== 'playing') {
    if (e.key === 'Enter' || e.key === ' ') resetGame();
    return;
  }
  switch (e.key) {
    case 'ArrowUp': case 'w': case 'W': tryMove(-1, 0); break;
    case 'ArrowDown': case 's': case 'S': tryMove(1, 0); break;
    case 'ArrowLeft': case 'a': case 'A': tryMove(0, -1); break;
    case 'ArrowRight': case 'd': case 'D': tryMove(0, 1); break;
    case ' ': placeBomb(); break;
    default: return;
  }
  e.preventDefault();
});

canvas.addEventListener('click', () => {
  if (status !== 'playing') resetGame();
});

// ---------- Dibujo ----------

function drawCellBg(r, c, color) {
  ctx.fillStyle = color;
  ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
}

function drawBoard() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (cell.type === 'wall') {
        drawCellBg(r, c, '#1a1a2e');
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      } else {
        drawCellBg(r, c, '#0d0d1a');
        if (cell.type === 'block') {
          ctx.save();
          ctx.fillStyle = '#3a3a55';
          ctx.strokeStyle = 'rgba(0, 255, 136, 0.25)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4, 4);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else if (exitRevealed && r === exitCell.r && c === exitCell.c) {
          ctx.save();
          ctx.shadowColor = '#ffcc00';
          ctx.shadowBlur = 16;
          ctx.fillStyle = '#ffcc00';
          ctx.beginPath();
          ctx.arc(c * CELL + CELL / 2, r * CELL + CELL / 2, CELL / 2 - 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }
}

function drawBombs() {
  const now = performance.now();
  for (const bomb of bombs) {
    if (bomb.exploded) {
      const age = now - bomb.explodedAt;
      const alpha = Math.max(0, 1 - age / 400);
      for (const [r, c] of computeBlast(bomb.r, bomb.c)) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 153, 51, ${alpha * 0.8})`;
        ctx.shadowColor = '#ff9933';
        ctx.shadowBlur = 20;
        ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);
        ctx.restore();
      }
    } else {
      const fuseProgress = (now - bomb.plantedAt) / BOMB_FUSE_MS;
      const pulse = 1 + Math.sin(now / (80 - fuseProgress * 50)) * 0.08;
      ctx.save();
      ctx.shadowColor = '#ff4466';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff4466';
      ctx.beginPath();
      ctx.arc(
        bomb.c * CELL + CELL / 2,
        bomb.r * CELL + CELL / 2,
        (CELL / 2 - 6) * pulse,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawPlayer() {
  ctx.save();
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#00ff88';
  ctx.beginPath();
  ctx.roundRect(player.c * CELL + 5, player.r * CELL + 5, CELL - 10, CELL - 10, 6);
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
  drawBoard();
  drawBombs();
  if (status === 'playing') drawPlayer();

  if (status === 'won') {
    drawOverlay();
    drawCenteredText('ESCAPASTE', canvas.height / 2 - 20, 18, '#00ff88', 20);
    drawCenteredText('toca o Enter para jugar de nuevo', canvas.height / 2 + 20, 7, '#8a8aa0', 0);
  } else if (status === 'lost') {
    drawOverlay();
    drawCenteredText('BOOM', canvas.height / 2 - 20, 18, '#ff4466', 20);
    drawCenteredText('toca o Enter para jugar de nuevo', canvas.height / 2 + 20, 7, '#8a8aa0', 0);
  }

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
