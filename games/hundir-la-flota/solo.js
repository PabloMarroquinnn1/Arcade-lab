const enemyBoardEl = document.getElementById('enemyBoard');
const myBoardEl = document.getElementById('myBoard');
const turnBadge = document.getElementById('turnBadge');
const bestShotsEl = document.getElementById('bestShots');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlaySub = document.getElementById('overlaySub');
const retryBtn = document.getElementById('retryBtn');

const SIZE = 10;
const SHIP_SIZES = [4, 3, 3, 2];
const BEST_SHOTS_KEY = 'arcade-lab:hundir-la-flota:mejor-partida';

let bestShots = Number(localStorage.getItem(BEST_SHOTS_KEY)) || null;
bestShotsEl.textContent = bestShots !== null ? String(bestShots) : '--';

let myFleet, enemyFleet, myFired, enemyFired, myShots, turn, status, botHuntQueue;

// ---------- Armar una flota al azar ----------

function emptyGrid() {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(null));
}

function placeFleet() {
  const grid = emptyGrid();
  const ships = [];
  let shipId = 0;

  for (const size of SHIP_SIZES) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() < 0.5;
      const r = Math.floor(Math.random() * SIZE);
      const c = Math.floor(Math.random() * SIZE);
      const cells = [];
      let valid = true;

      for (let i = 0; i < size; i++) {
        const rr = horizontal ? r : r + i;
        const cc = horizontal ? c + i : c;
        if (rr >= SIZE || cc >= SIZE || grid[rr][cc] !== null) {
          valid = false;
          break;
        }
        cells.push([rr, cc]);
      }

      if (valid) {
        for (const [rr, cc] of cells) grid[rr][cc] = shipId;
        ships.push({ id: shipId, size, cells, hits: 0, sunk: false });
        shipId++;
        placed = true;
      }
    }
  }

  return { grid, ships };
}

function fireAt(fleet, r, c) {
  const shipId = fleet.grid[r][c];
  if (shipId === null) return { result: 'miss' };
  const ship = fleet.ships[shipId];
  ship.hits++;
  if (ship.hits >= ship.size) {
    ship.sunk = true;
    return { result: 'sunk', cells: ship.cells };
  }
  return { result: 'hit' };
}

function allSunk(fleet) {
  return fleet.ships.every((s) => s.sunk);
}

// ---------- IA simple: al azar, y "caza" alrededor de un impacto ----------

function botChooseCell() {
  while (botHuntQueue.length > 0) {
    const [r, c] = botHuntQueue.shift();
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE && !myFired[r][c]) return [r, c];
  }
  let r, c;
  do {
    r = Math.floor(Math.random() * SIZE);
    c = Math.floor(Math.random() * SIZE);
  } while (myFired[r][c]);
  return [r, c];
}

function botRegisterResult(r, c, result) {
  if (result === 'hit') {
    botHuntQueue.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
  } else if (result === 'sunk') {
    botHuntQueue = [];
  }
}

// ---------- Juego ----------

function resetGame() {
  myFleet = placeFleet();
  enemyFleet = placeFleet();
  myFired = emptyGrid();
  enemyFired = emptyGrid();
  myShots = 0;
  turn = 'player';
  status = 'playing';
  botHuntQueue = [];
  overlay.classList.remove('visible');
  turnBadge.textContent = 'Tu turno';
  renderBoards();
}

function playerFire(r, c) {
  if (status !== 'playing' || turn !== 'player' || enemyFired[r][c]) return;

  myShots++;
  const { result } = fireAt(enemyFleet, r, c);
  enemyFired[r][c] = result;
  renderBoards();

  if (allSunk(enemyFleet)) return endGame('win');

  turn = 'bot';
  turnBadge.textContent = 'Turno de la compu...';
  setTimeout(botTurn, 500);
}

function botTurn() {
  if (status !== 'playing') return;
  const [r, c] = botChooseCell();
  const { result } = fireAt(myFleet, r, c);
  myFired[r][c] = result;
  botRegisterResult(r, c, result);
  renderBoards();

  if (allSunk(myFleet)) return endGame('lose');

  turn = 'player';
  turnBadge.textContent = 'Tu turno';
}

function endGame(resultado) {
  status = resultado === 'win' ? 'won' : 'lost';
  renderBoards();

  if (resultado === 'win') {
    if (bestShots === null || myShots < bestShots) {
      bestShots = myShots;
      localStorage.setItem(BEST_SHOTS_KEY, String(bestShots));
      bestShotsEl.textContent = String(bestShots);
    }
    overlayTitle.textContent = 'HUNDISTE TODA LA FLOTA';
    overlayTitle.className = 'overlay-title win';
    overlaySub.textContent = `Te tomó ${myShots} disparos.`;
  } else {
    overlayTitle.textContent = 'HUNDIERON TU FLOTA';
    overlayTitle.className = 'overlay-title lose';
    overlaySub.textContent = 'La compu ganó esta vez.';
  }
  overlay.classList.add('visible');
}

retryBtn.addEventListener('click', resetGame);

// ---------- Dibujo ----------

function buildBoard(boardEl, onCellClick) {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      if (onCellClick) {
        cell.addEventListener('click', () => onCellClick(r, c));
      }
      boardEl.appendChild(cell);
    }
  }
}

function renderBoards() {
  updateBoardCells(enemyBoardEl, enemyFleet, enemyFired, false);
  updateBoardCells(myBoardEl, myFleet, myFired, true);
}

function updateBoardCells(boardEl, fleet, fired, showShips) {
  const cells = boardEl.children;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const idx = r * SIZE + c;
      const cellEl = cells[idx];
      const shot = fired[r][c];
      const hasShip = fleet.grid[r][c] !== null;

      let cls = 'cell';
      if (!shot && showShips && hasShip) cls += ' ship';
      else if (!shot) cls += ' water';
      if (!shot && boardEl === enemyBoardEl && status === 'playing' && turn === 'player') cls += ' clickable';

      if (shot === 'miss') cls += ' miss';
      else if (shot === 'hit') cls += ' hit';
      else if (shot === 'sunk') cls += ' sunk';

      cellEl.className = cls;
      cellEl.textContent = shot === 'miss' ? '·' : shot === 'hit' || shot === 'sunk' ? '✕' : '';
    }
  }
}

buildBoard(enemyBoardEl, (r, c) => playerFire(r, c));
buildBoard(myBoardEl, null);
resetGame();
