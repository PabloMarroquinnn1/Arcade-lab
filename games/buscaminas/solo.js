const boardEl = document.getElementById('board');
const minesLeftEl = document.getElementById('minesLeft');
const timerEl = document.getElementById('timer');
const bestTimeEl = document.getElementById('bestTime');
const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlaySubEl = document.getElementById('overlaySub');
const flagModeBtn = document.getElementById('flagModeBtn');

const COLS = 12;
const ROWS = 12;
const MINES = 24;
const BEST_TIME_KEY = 'arcade-lab:buscaminas:mejor-tiempo';

let board, cellEls, status, firstClick, flagsPlaced, revealedCount, startTime, timerInterval, flagMode;

let bestTime = Number(localStorage.getItem(BEST_TIME_KEY)) || null;
bestTimeEl.textContent = bestTime ? `${bestTime}s` : '--';

function emptyBoard() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
  );
}

function placeMines(excludeR, excludeC) {
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    const tooCloseToFirstClick = Math.abs(r - excludeR) <= 1 && Math.abs(c - excludeC) <= 1;
    if (tooCloseToFirstClick || board[r][c].mine) continue;
    board[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c].mine) board[r][c].adjacent = countAdjacentMines(r, c);
    }
  }
}

function countAdjacentMines(r, c) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].mine) count++;
    }
  }
  return count;
}

function buildBoardDom() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${COLS}, 28px)`;
  cellEls = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const el = document.createElement('div');
      el.className = 'cell hidden';
      el.addEventListener('click', () => onCellClick(r, c));
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleFlag(r, c);
      });
      boardEl.appendChild(el);
      row.push(el);
    }
    cellEls.push(row);
  }
}

function resetGame() {
  board = emptyBoard();
  status = 'playing';
  firstClick = true;
  flagsPlaced = 0;
  revealedCount = 0;
  flagMode = false;
  flagModeBtn.classList.remove('active');
  overlayEl.classList.remove('visible');
  clearInterval(timerInterval);
  timerEl.textContent = '0';
  minesLeftEl.textContent = String(MINES);
  buildBoardDom();
}

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    timerEl.textContent = String(Math.floor((Date.now() - startTime) / 1000));
  }, 1000);
}

function onCellClick(r, c) {
  if (status !== 'playing') return;
  if (flagMode) {
    toggleFlag(r, c);
  } else {
    reveal(r, c);
  }
}

function toggleFlag(r, c) {
  if (status !== 'playing') return;
  const cell = board[r][c];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  flagsPlaced += cell.flagged ? 1 : -1;
  minesLeftEl.textContent = String(Math.max(0, MINES - flagsPlaced));
  renderCell(r, c);
}

function reveal(r, c) {
  const start = board[r][c];
  if (start.revealed || start.flagged) return;

  if (firstClick) {
    placeMines(r, c);
    firstClick = false;
    startTimer();
  }

  const stack = [[r, c]];
  while (stack.length > 0) {
    const [cr, cc] = stack.pop();
    const cell = board[cr][cc];
    if (cell.revealed || cell.flagged) continue;

    cell.revealed = true;
    revealedCount++;
    renderCell(cr, cc);

    if (cell.mine) {
      loseGame();
      return;
    }

    if (cell.adjacent === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !board[nr][nc].revealed && !board[nr][nc].flagged) {
            stack.push([nr, nc]);
          }
        }
      }
    }
  }

  checkWin();
}

function checkWin() {
  if (revealedCount === ROWS * COLS - MINES) {
    winGame();
  }
}

function loseGame() {
  status = 'lost';
  clearInterval(timerInterval);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].mine) {
        board[r][c].revealed = true;
        renderCell(r, c);
      }
    }
  }
  showOverlay('lose', 'BOOM', 'Toca en cualquier lado para jugar de nuevo');
}

function winGame() {
  status = 'won';
  clearInterval(timerInterval);
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  let subtitle = `${elapsed}s`;
  if (bestTime === null || elapsed < bestTime) {
    bestTime = elapsed;
    localStorage.setItem(BEST_TIME_KEY, String(bestTime));
    bestTimeEl.textContent = `${bestTime}s`;
    subtitle += ' — ¡nuevo récord!';
  }
  showOverlay('win', 'GANASTE', subtitle);
}

function showOverlay(kind, title, sub) {
  overlayTitleEl.textContent = title;
  overlayTitleEl.className = 'overlay-title ' + kind;
  overlaySubEl.textContent = sub;
  overlayEl.classList.add('visible');
}

overlayEl.addEventListener('click', () => resetGame());

flagModeBtn.addEventListener('click', () => {
  flagMode = !flagMode;
  flagModeBtn.classList.toggle('active', flagMode);
});

function renderCell(r, c) {
  const cell = board[r][c];
  const el = cellEls[r][c];
  el.className = 'cell';
  el.textContent = '';

  if (cell.flagged && !cell.revealed) {
    el.classList.add('flagged');
    el.textContent = '🚩';
  } else if (!cell.revealed) {
    el.classList.add('hidden');
  } else if (cell.mine) {
    el.classList.add('mine');
    el.textContent = '💣';
  } else if (cell.adjacent > 0) {
    el.classList.add('revealed', 'n' + cell.adjacent);
    el.textContent = String(cell.adjacent);
  } else {
    el.classList.add('revealed');
  }
}

resetGame();
