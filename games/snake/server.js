const GRID_COLS = 32;
const GRID_ROWS = 20;
const TICK_MS = 120;
const COUNTDOWN_MS = 3000;
const RESTART_DELAY_MS = 5000;
const START_LENGTH = 3;

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function isOpposite(a, b) {
  return a.x === -b.x && a.y === -b.y;
}

// Namespace propio ('/snake'), igual que Pong con '/pong': cada juego en
// tiempo real tiene sus eventos aislados dentro del mismo servidor.
module.exports = function attachSnake(io) {
  const snake = io.of('/snake');

  const players = {};
  let player1Id = null;
  let player2Id = null;
  let gameLoopInterval = null;

  function makeSnake(startX, startY, direction) {
    const segments = [];
    for (let i = 0; i < START_LENGTH; i++) {
      segments.push({ x: startX - direction.x * i, y: startY - direction.y * i });
    }
    return { segments, direction, nextDirection: direction, alive: true, score: 0 };
  }

  function randomFood(occupied) {
    let cell;
    let attempts = 0;
    do {
      cell = { x: Math.floor(Math.random() * GRID_COLS), y: Math.floor(Math.random() * GRID_ROWS) };
      attempts++;
    } while (occupied.some((seg) => seg.x === cell.x && seg.y === cell.y) && attempts < 200);
    return cell;
  }

  function createRoundState() {
    const p1 = makeSnake(8, Math.floor(GRID_ROWS / 2), DIRECTIONS.right);
    const p2 = makeSnake(GRID_COLS - 9, Math.floor(GRID_ROWS / 2), DIRECTIONS.left);
    return {
      p1,
      p2,
      food: randomFood([...p1.segments, ...p2.segments]),
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

  function applyDirection(player) {
    if (!isOpposite(player.nextDirection, player.direction)) {
      player.direction = player.nextDirection;
    }
  }

  function tick() {
    if (state.status === 'countdown') {
      if (Date.now() >= state.countdownUntil) state.status = 'playing';
      return;
    }
    if (state.status !== 'playing') return;

    const alivePlayers = [state.p1, state.p2].filter((p) => p.alive);
    for (const p of alivePlayers) applyDirection(p);

    for (const p of alivePlayers) {
      const head = p.segments[0];
      p.newHead = { x: head.x + p.direction.x, y: head.y + p.direction.y };
      p.willGrow = p.newHead.x === state.food.x && p.newHead.y === state.food.y;
    }

    for (const p of alivePlayers) {
      if (p.newHead.x < 0 || p.newHead.x >= GRID_COLS || p.newHead.y < 0 || p.newHead.y >= GRID_ROWS) {
        p.alive = false;
      }
    }

    // futureBody: donde va a estar el cuerpo DESPUES de moverse (la cola se
    // vacia esta misma vuelta, salvo que la vibora este por crecer).
    for (const p of alivePlayers) {
      if (!p.alive) continue;
      p.futureBody = p.willGrow ? p.segments : p.segments.slice(0, -1);
    }

    for (const p of alivePlayers) {
      if (!p.alive) continue;
      const opponent = p === state.p1 ? state.p2 : state.p1;
      const hitsSelf = p.futureBody.some((seg) => seg.x === p.newHead.x && seg.y === p.newHead.y);
      const hitsOpponent =
        opponent.alive &&
        opponent.futureBody &&
        opponent.futureBody.some((seg) => seg.x === p.newHead.x && seg.y === p.newHead.y);
      const headOn =
        opponent.alive &&
        opponent.newHead &&
        opponent.newHead.x === p.newHead.x &&
        opponent.newHead.y === p.newHead.y;
      if (hitsSelf || hitsOpponent || headOn) p.alive = false;
    }

    for (const p of alivePlayers) {
      if (!p.alive) continue;
      p.segments.unshift(p.newHead);
      if (p.willGrow) {
        p.score++;
        state.food = randomFood([...state.p1.segments, ...state.p2.segments]);
      } else {
        p.segments.pop();
      }
    }

    const stillAlive = [state.p1, state.p2].filter((p) => p.alive);
    if (stillAlive.length === 0) endRound('draw');
    else if (stillAlive.length === 1) endRound(stillAlive[0] === state.p1 ? 'p1' : 'p2');
  }

  function emitState() {
    const now = Date.now();
    snake.volatile.emit('gameState', {
      p1: { segments: state.p1.segments, score: state.p1.score, alive: state.p1.alive },
      p2: { segments: state.p2.segments, score: state.p2.score, alive: state.p2.alive },
      food: state.food,
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

  snake.on('connection', (socket) => {
    console.log(`Snake: connected ${socket.id}`);
    players[socket.id] = { socket };

    if (!player1Id) {
      player1Id = socket.id;
    } else if (!player2Id) {
      player2Id = socket.id;
      startRound();
    }

    startGameLoop();
    broadcastRoles();

    socket.on('setDirection', (data) => {
      if (!data || typeof data.direction !== 'string') return;
      const direction = DIRECTIONS[data.direction];
      if (!direction) return;
      if (socket.id === player1Id) state.p1.nextDirection = direction;
      else if (socket.id === player2Id) state.p2.nextDirection = direction;
    });

    socket.on('latency', (cb) => {
      if (typeof cb === 'function') cb();
    });

    socket.on('disconnect', () => {
      console.log(`Snake: disconnected ${socket.id}`);
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
