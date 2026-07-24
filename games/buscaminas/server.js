const COLS = 16;
const ROWS = 16;
const MINES = 40;
const RESTART_DELAY_MS = 5000;

const PLAYER_COLORS = ['#00ff88', '#ff4466', '#ffcc00', '#4477ff', '#aa66ff', '#00ccff', '#ff9933'];

function emptyBoard() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
  );
}

function countAdjacentMines(board, r, c) {
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

function placeMines(board, excludeR, excludeC) {
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
      if (!board[r][c].mine) board[r][c].adjacent = countAdjacentMines(board, r, c);
    }
  }
}

// Namespace propio ('/buscaminas'), mismo principio que los demas juegos en
// tiempo real — ver docs/aprende/14-logica-de-los-juegos-en-tiempo-real.md.
// A diferencia de Pong/Snake/Cascada, ESTE juego no tiene loop a intervalo:
// nada se mueve solo, asi que el servidor solo manda estado nuevo cuando
// alguien hace algo (destapar/marcar), no en cada tick.
module.exports = function attachBuscaminas(io) {
  const buscaminas = io.of('/buscaminas');

  const players = {};
  let colorIndex = 0;
  let board, status, seeded, revealedCount, flagsPlaced, restartTimeout;

  function createRound() {
    if (restartTimeout) {
      clearTimeout(restartTimeout);
      restartTimeout = null;
    }
    board = emptyBoard();
    status = 'playing'; // playing | won | lost
    seeded = false;
    revealedCount = 0;
    flagsPlaced = 0;
  }

  createRound();

  function scheduleRestart() {
    restartTimeout = setTimeout(() => {
      createRound();
      broadcastState();
    }, RESTART_DELAY_MS);
  }

  function loseRound() {
    status = 'lost';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c].mine) board[r][c].revealed = true;
      }
    }
    scheduleRestart();
  }

  function checkWin() {
    if (revealedCount === ROWS * COLS - MINES) {
      status = 'won';
      scheduleRestart();
    }
  }

  function handleReveal(r, c) {
    if (status !== 'playing') return;
    const start = board[r][c];
    if (start.revealed || start.flagged) return;

    if (!seeded) {
      placeMines(board, r, c);
      seeded = true;
    }

    const stack = [[r, c]];
    while (stack.length > 0) {
      const [cr, cc] = stack.pop();
      const cell = board[cr][cc];
      if (cell.revealed || cell.flagged) continue;

      cell.revealed = true;
      revealedCount++;

      if (cell.mine) {
        loseRound();
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

  function handleFlag(r, c) {
    if (status !== 'playing') return;
    const cell = board[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    flagsPlaced += cell.flagged ? 1 : -1;
  }

  function serializeBoard() {
    return board.map((row) =>
      row.map((cell) => {
        if (cell.revealed) {
          return cell.mine ? { revealed: true, mine: true } : { revealed: true, adjacent: cell.adjacent };
        }
        if (cell.flagged) return { revealed: false, flagged: true };
        return { revealed: false };
      })
    );
  }

  // gameState NO es volatile a proposito: cada destape/bandera es un evento
  // puntual e importante (no un stream de 60/seg como Pong), asi que aca
  // conviene entrega garantizada en vez de "si se pierde uno, ya viene el
  // siguiente".
  function broadcastState() {
    buscaminas.emit('gameState', {
      board: serializeBoard(),
      status,
      minesLeft: Math.max(0, MINES - flagsPlaced),
      restartIn: status !== 'playing' ? Math.ceil(RESTART_DELAY_MS / 1000) : 0,
    });
  }

  function broadcastPlayerCount() {
    buscaminas.emit('players', { count: Object.keys(players).length });
  }

  buscaminas.on('connection', (socket) => {
    console.log(`Buscaminas: connected ${socket.id}`);
    const color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
    colorIndex++;
    players[socket.id] = { socket, color };

    socket.emit('welcome', { color });
    socket.emit('gameState', {
      board: serializeBoard(),
      status,
      minesLeft: Math.max(0, MINES - flagsPlaced),
      restartIn: 0,
    });
    broadcastPlayerCount();

    socket.on('reveal', (data) => {
      if (!data || !Number.isInteger(data.r) || !Number.isInteger(data.c)) return;
      if (data.r < 0 || data.r >= ROWS || data.c < 0 || data.c >= COLS) return;
      handleReveal(data.r, data.c);
      broadcastState();
    });

    socket.on('flag', (data) => {
      if (!data || !Number.isInteger(data.r) || !Number.isInteger(data.c)) return;
      if (data.r < 0 || data.r >= ROWS || data.c < 0 || data.c >= COLS) return;
      handleFlag(data.r, data.c);
      broadcastState();
    });

    // Los cursores son solo cosmeticos (no afectan el juego), asi que aca SI
    // usamos volatile: si se pierde una posicion intermedia no importa nada.
    socket.on('cursor', (data) => {
      if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') return;
      socket.broadcast.volatile.emit('cursor', { id: socket.id, color, x: data.x, y: data.y });
    });

    socket.on('latency', (cb) => {
      if (typeof cb === 'function') cb();
    });

    socket.on('disconnect', () => {
      console.log(`Buscaminas: disconnected ${socket.id}`);
      delete players[socket.id];
      buscaminas.emit('playerLeft', { id: socket.id });
      broadcastPlayerCount();
      if (Object.keys(players).length === 0) {
        createRound();
      }
    });
  });
};
