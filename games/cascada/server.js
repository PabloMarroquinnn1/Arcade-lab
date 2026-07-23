const COLS = 10;
const ROWS = 20;
// Velocidad fija (no sube con el nivel como en el modo solo): en un versus
// los dos juegan mas parejo si caen a la misma velocidad todo el tiempo.
const TICK_MS = 500;
const COUNTDOWN_MS = 3000;
const RESTART_DELAY_MS = 5000;
const GARBAGE_MAP = { 1: 0, 2: 1, 3: 2, 4: 4 };

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

// Namespace propio ('/cascada'), mismo patron que Pong ('/pong') y Snake
// ('/snake') — ver docs/aprende/14-logica-de-los-juegos-en-tiempo-real.md.
module.exports = function attachCascada(io) {
  const cascada = io.of('/cascada');

  const players = {};
  let player1Id = null;
  let player2Id = null;
  let gameLoopInterval = null;

  function emptyGrid() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  }

  function spawnPiece(pState) {
    const type = pState.nextType;
    pState.nextType = randomType();
    pState.current = {
      shape: PIECES[type].shape.map((row) => row.slice()),
      color: PIECES[type].color,
      x: Math.floor((COLS - 4) / 2),
      y: 0,
    };
  }

  function makePlayerState() {
    const pState = { grid: emptyGrid(), score: 0, alive: true, nextType: randomType() };
    spawnPiece(pState);
    return pState;
  }

  function createRoundState() {
    return {
      p1: makePlayerState(),
      p2: makePlayerState(),
      status: 'waiting', // waiting | countdown | playing | gameover
      countdownUntil: 0,
      restartAt: 0,
      winner: null, // 'p1' | 'p2' | 'draw' | null
    };
  }

  let state = createRoundState();

  function startRound() {
    state = createRoundState();
    state.status = 'countdown';
    state.countdownUntil = Date.now() + COUNTDOWN_MS;
  }

  function endRound(winner) {
    state.status = 'gameover';
    state.winner = winner;
    state.restartAt = Date.now() + RESTART_DELAY_MS;
  }

  function tryMove(pState, dx, dy) {
    const c = pState.current;
    const nx = c.x + dx;
    const ny = c.y + dy;
    if (isValidPosition(c.shape, nx, ny, pState.grid)) {
      c.x = nx;
      c.y = ny;
      return true;
    }
    return false;
  }

  function clearLines(pState) {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (pState.grid[r].every((cell) => cell !== null)) {
        pState.grid.splice(r, 1);
        pState.grid.unshift(new Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    return cleared;
  }

  // Si arriba de todo ya hay bloques, no hay lugar para mas basura: pierde.
  function addGarbage(pState, count) {
    for (let i = 0; i < count; i++) {
      if (pState.grid[0].some((cell) => cell !== null)) {
        pState.alive = false;
        return;
      }
      pState.grid.shift();
      const gap = Math.floor(Math.random() * COLS);
      const row = new Array(COLS).fill('#444455');
      row[gap] = null;
      pState.grid.push(row);
    }
    if (!isValidPosition(pState.current.shape, pState.current.x, pState.current.y, pState.grid)) {
      pState.alive = false;
    }
  }

  function lockPiece(pState, opponentState) {
    const { shape, x, y, color } = pState.current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] && y + r >= 0) pState.grid[y + r][x + c] = color;
      }
    }
    const cleared = clearLines(pState);
    if (cleared > 0) {
      pState.score += [0, 100, 300, 500, 800][cleared] || 800;
      const garbage = GARBAGE_MAP[cleared] || 0;
      if (garbage > 0 && opponentState.alive) addGarbage(opponentState, garbage);
    }
    spawnPiece(pState);
    if (!isValidPosition(pState.current.shape, pState.current.x, pState.current.y, pState.grid)) {
      pState.alive = false;
    }
  }

  function tick() {
    if (state.status === 'countdown') {
      if (Date.now() >= state.countdownUntil) state.status = 'playing';
      return;
    }
    if (state.status !== 'playing') return;

    for (const [pState, oState] of [[state.p1, state.p2], [state.p2, state.p1]]) {
      if (!pState.alive) continue;
      if (!tryMove(pState, 0, 1)) lockPiece(pState, oState);
    }

    const alive = [state.p1, state.p2].filter((p) => p.alive);
    if (alive.length === 0) endRound('draw');
    else if (alive.length === 1) endRound(alive[0] === state.p1 ? 'p1' : 'p2');
  }

  function serializePlayer(pState) {
    return {
      grid: pState.grid,
      current: pState.current,
      score: pState.score,
      alive: pState.alive,
    };
  }

  function emitState() {
    const now = Date.now();
    cascada.volatile.emit('gameState', {
      p1: serializePlayer(state.p1),
      p2: serializePlayer(state.p2),
      status: state.status,
      countdown: state.status === 'countdown' ? Math.max(0, Math.ceil((state.countdownUntil - now) / 1000)) : 0,
      restartIn: state.status === 'gameover' ? Math.max(0, Math.ceil((state.restartAt - now) / 1000)) : 0,
      winner: state.winner,
    });
  }

  function gameLoop() {
    tick();
    if (state.status === 'gameover' && Date.now() >= state.restartAt && player1Id && player2Id) {
      startRound();
    }
    emitState();
  }

  function startGameLoop() {
    if (gameLoopInterval) return;
    gameLoopInterval = setInterval(gameLoop, TICK_MS);
  }

  function stopGameLoop() {
    if (gameLoopInterval) {
      clearInterval(gameLoopInterval);
      gameLoopInterval = null;
    }
  }

  function broadcastRoles() {
    const spectators = Object.keys(players).filter((id) => id !== player1Id && id !== player2Id).length;
    for (const [id, player] of Object.entries(players)) {
      let role = 'spectator';
      if (id === player1Id) role = 'player1';
      else if (id === player2Id) role = 'player2';
      player.socket.emit('role', { role, spectators });
    }
  }

  cascada.on('connection', (socket) => {
    console.log(`Cascada: connected ${socket.id}`);
    players[socket.id] = { socket };

    if (!player1Id) {
      player1Id = socket.id;
    } else if (!player2Id) {
      player2Id = socket.id;
      startRound();
    }

    startGameLoop();
    broadcastRoles();

    function myState() {
      if (socket.id === player1Id) return state.p1;
      if (socket.id === player2Id) return state.p2;
      return null;
    }

    socket.on('action', (data) => {
      if (state.status !== 'playing') return;
      const pState = myState();
      if (!pState || !pState.alive) return;
      if (!data || typeof data.type !== 'string') return;

      const oState = pState === state.p1 ? state.p2 : state.p1;

      switch (data.type) {
        case 'left':
          tryMove(pState, -1, 0);
          break;
        case 'right':
          tryMove(pState, 1, 0);
          break;
        case 'softDrop':
          if (!tryMove(pState, 0, 1)) lockPiece(pState, oState);
          break;
        case 'rotate': {
          const rotated = rotateMatrix(pState.current.shape);
          if (isValidPosition(rotated, pState.current.x, pState.current.y, pState.grid)) {
            pState.current.shape = rotated;
          }
          break;
        }
        case 'hardDrop':
          while (tryMove(pState, 0, 1)) { /* sigue cayendo */ }
          lockPiece(pState, oState);
          break;
        default:
          break;
      }
    });

    socket.on('latency', (cb) => {
      if (typeof cb === 'function') cb();
    });

    socket.on('disconnect', () => {
      console.log(`Cascada: disconnected ${socket.id}`);
      delete players[socket.id];

      if (Object.keys(players).length === 0) {
        stopGameLoop();
        player1Id = null;
        player2Id = null;
        state = createRoundState();
        return;
      }

      if (socket.id === player1Id || socket.id === player2Id) {
        state = createRoundState();
        player1Id = null;
        player2Id = null;

        const remaining = Object.keys(players);
        if (remaining.length >= 1) player1Id = remaining[0];
        if (remaining.length >= 2) player2Id = remaining[1];

        if (player1Id && player2Id) startRound();
        broadcastRoles();
      } else {
        broadcastRoles();
      }
    });
  });
};
