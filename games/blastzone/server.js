const COLS = 13;
const ROWS = 11;
const TICK_MS = 100;
const COUNTDOWN_MS = 3000;
const RESTART_DELAY_MS = 5000;
const MOVE_COOLDOWN_MS = 150;
const BOMB_FUSE_MS = 2200;
const BLAST_RADIUS = 2;
const MAX_BOMBS = 1;
const BLOCK_CHANCE = 0.6;

function buildArena() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      let type = 'empty';
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) type = 'wall';
      else if (r % 2 === 0 && c % 2 === 0) type = 'wall';
      row.push({ type });
    }
    grid.push(row);
  }

  // Esquinas libres para que ningun jugador arranque encerrado.
  const spawnClear = [
    [1, 1], [1, 2], [2, 1],
    [ROWS - 2, COLS - 2], [ROWS - 2, COLS - 3], [ROWS - 3, COLS - 2],
  ];

  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[r][c].type === 'wall') continue;
      if (spawnClear.some(([sr, sc]) => sr === r && sc === c)) continue;
      if (Math.random() < BLOCK_CHANCE) grid[r][c].type = 'block';
    }
  }

  return grid;
}

function computeBlast(grid, r, c) {
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

// Namespace propio ('/blastzone'), mismo patron que Pong/Snake/Cascada — ver
// docs/aprende/14-logica-de-los-juegos-en-tiempo-real.md. Vuelve al esquema
// de roles 1v1 (a diferencia de Buscaminas, que es cooperativo) porque acá
// es competitivo: gana quien queda vivo.
module.exports = function attachBlastzone(io) {
  const blastzone = io.of('/blastzone');

  const players = {};
  let player1Id = null;
  let player2Id = null;
  let gameLoopInterval = null;

  function makePlayerState(r, c) {
    return { r, c, alive: true, lastMoveAt: 0 };
  }

  function createRoundState() {
    return {
      grid: buildArena(),
      p1: makePlayerState(1, 1),
      p2: makePlayerState(ROWS - 2, COLS - 2),
      bombs: [], // { owner: 'p1'|'p2', r, c, plantedAt, exploded, explodedAt }
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

  function isWalkable(r, c) {
    const cell = state.grid[r][c];
    if (cell.type === 'wall' || cell.type === 'block') return false;
    if (state.bombs.some((b) => !b.exploded && b.r === r && b.c === c)) return false;
    return true;
  }

  function tryMove(pState, dr, dc) {
    const now = Date.now();
    if (now - pState.lastMoveAt < MOVE_COOLDOWN_MS) return;
    const nr = pState.r + dr;
    const nc = pState.c + dc;
    if (!isWalkable(nr, nc)) return;
    pState.r = nr;
    pState.c = nc;
    pState.lastMoveAt = now;
  }

  function placeBomb(owner, pState) {
    const activeOwnBombs = state.bombs.filter((b) => !b.exploded && b.owner === owner);
    if (activeOwnBombs.length >= MAX_BOMBS) return;
    if (state.bombs.some((b) => !b.exploded && b.r === pState.r && b.c === pState.c)) return;
    state.bombs.push({ owner, r: pState.r, c: pState.c, plantedAt: Date.now(), exploded: false, explodedAt: 0 });
  }

  function explodeBomb(bomb) {
    const queue = [bomb];
    const blastCells = [];

    while (queue.length > 0) {
      const b = queue.pop();
      if (b.exploded) continue;
      b.exploded = true;
      b.explodedAt = Date.now();

      const cells = computeBlast(state.grid, b.r, b.c);
      blastCells.push(...cells);

      for (const [r, c] of cells) {
        const cell = state.grid[r][c];
        if (cell.type === 'block') cell.type = 'empty';
        const chained = state.bombs.find((x) => !x.exploded && x.r === r && x.c === c);
        if (chained) queue.push(chained);
      }
    }

    for (const [r, c] of blastCells) {
      if (state.p1.alive && state.p1.r === r && state.p1.c === c) state.p1.alive = false;
      if (state.p2.alive && state.p2.r === r && state.p2.c === c) state.p2.alive = false;
    }
  }

  function tick() {
    if (state.status === 'countdown') {
      if (Date.now() >= state.countdownUntil) state.status = 'playing';
      return;
    }
    if (state.status !== 'playing') return;

    const now = Date.now();
    for (const bomb of state.bombs) {
      if (!bomb.exploded && now - bomb.plantedAt >= BOMB_FUSE_MS) {
        explodeBomb(bomb);
      }
    }
    state.bombs = state.bombs.filter((b) => !b.exploded || now - b.explodedAt < 400);

    if (!state.p1.alive && !state.p2.alive) endRound('draw');
    else if (!state.p1.alive) endRound('p2');
    else if (!state.p2.alive) endRound('p1');
  }

  function emitState() {
    const now = Date.now();
    blastzone.volatile.emit('gameState', {
      grid: state.grid,
      p1: state.p1,
      p2: state.p2,
      bombs: state.bombs,
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

  blastzone.on('connection', (socket) => {
    console.log(`Blastzone: connected ${socket.id}`);
    players[socket.id] = { socket };

    if (!player1Id) {
      player1Id = socket.id;
    } else if (!player2Id) {
      player2Id = socket.id;
      startRound();
    }

    startGameLoop();
    broadcastRoles();

    const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

    socket.on('move', (data) => {
      if (state.status !== 'playing') return;
      const dir = data && DIRS[data.direction];
      if (!dir) return;
      if (socket.id === player1Id && state.p1.alive) tryMove(state.p1, dir[0], dir[1]);
      else if (socket.id === player2Id && state.p2.alive) tryMove(state.p2, dir[0], dir[1]);
    });

    socket.on('placeBomb', () => {
      if (state.status !== 'playing') return;
      if (socket.id === player1Id && state.p1.alive) placeBomb('p1', state.p1);
      else if (socket.id === player2Id && state.p2.alive) placeBomb('p2', state.p2);
    });

    socket.on('latency', (cb) => {
      if (typeof cb === 'function') cb();
    });

    socket.on('disconnect', () => {
      console.log(`Blastzone: disconnected ${socket.id}`);
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
