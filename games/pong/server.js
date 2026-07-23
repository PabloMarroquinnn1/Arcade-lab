const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 90;
const PADDLE_SPEED = 7;
const PADDLE_TOUCH_SPEED = 11;
const PADDLE_MARGIN = 20;
const BALL_SIZE = 10;
const INITIAL_BALL_SPEED = 5;
const SPEED_INCREMENT = 0.35;
const MAX_BALL_SPEED = 14;
const TICK_RATE = 1000 / 60;
const WIN_SCORE = 7;
const COUNTDOWN_START_MS = 3000;
const COUNTDOWN_GOAL_MS = 1000;
const RESTART_DELAY_MS = 6000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Namespace propio ('/pong') para que sus eventos de socket no choquen con
// los de otros juegos en tiempo real que se agreguen mas adelante.
module.exports = function attachPong(io) {
  const pong = io.of('/pong');

  const players = {};
  let player1Id = null;
  let player2Id = null;
  let gameLoopInterval = null;

  function createGameState() {
    return {
      ball: {
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT / 2,
        vx: 0,
        vy: 0,
      },
      paddles: {
        left: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
        right: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
      },
      score: { p1: 0, p2: 0 },
      status: 'waiting', // waiting | countdown | playing | gameover
      countdownUntil: 0,
      restartAt: 0,
      winner: null,
    };
  }

  let game = createGameState();

  function launchBall(direction) {
    game.ball.x = CANVAS_WIDTH / 2;
    game.ball.y = CANVAS_HEIGHT / 2;
    const angle = (Math.random() * 0.6 - 0.3) * Math.PI; // -54 a 54 grados
    game.ball.vx = INITIAL_BALL_SPEED * Math.cos(angle) * direction;
    game.ball.vy = INITIAL_BALL_SPEED * Math.sin(angle);
  }

  function startMatch() {
    game = createGameState();
    game.status = 'countdown';
    game.countdownUntil = Date.now() + COUNTDOWN_START_MS;
    game.pendingServe = Math.random() > 0.5 ? 1 : -1;
  }

  function updatePaddles() {
    for (const id of [player1Id, player2Id]) {
      if (!id || !players[id]) continue;
      const input = players[id].input;
      const side = id === player1Id ? 'left' : 'right';
      const paddle = game.paddles[side];

      if (typeof input.targetY === 'number') {
        const center = paddle.y + PADDLE_HEIGHT / 2;
        const diff = input.targetY - center;
        if (Math.abs(diff) > 3) {
          paddle.y += clamp(diff, -PADDLE_TOUCH_SPEED, PADDLE_TOUCH_SPEED);
        }
      } else {
        if (input.up) paddle.y -= PADDLE_SPEED;
        if (input.down) paddle.y += PADDLE_SPEED;
      }
      paddle.y = clamp(paddle.y, 0, CANVAS_HEIGHT - PADDLE_HEIGHT);
    }
  }

  function bounceOffPaddle(paddle, directionOut) {
    const ball = game.ball;
    const speed = Math.min(
      Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) + SPEED_INCREMENT,
      MAX_BALL_SPEED
    );
    const hitPos = clamp((ball.y - paddle.y) / PADDLE_HEIGHT, 0, 1);
    const angle = (hitPos - 0.5) * (Math.PI / 3); // max +-60 grados
    ball.vx = speed * Math.cos(angle) * directionOut;
    ball.vy = speed * Math.sin(angle);
  }

  function onGoal(scoredBy) {
    game.score[scoredBy]++;
    if (game.score[scoredBy] >= WIN_SCORE) {
      game.status = 'gameover';
      game.winner = scoredBy;
      game.restartAt = Date.now() + RESTART_DELAY_MS;
      game.ball.vx = 0;
      game.ball.vy = 0;
      game.ball.x = CANVAS_WIDTH / 2;
      game.ball.y = CANVAS_HEIGHT / 2;
    } else {
      game.status = 'countdown';
      game.countdownUntil = Date.now() + COUNTDOWN_GOAL_MS;
      game.pendingServe = scoredBy === 'p1' ? -1 : 1;
      game.ball.x = CANVAS_WIDTH / 2;
      game.ball.y = CANVAS_HEIGHT / 2;
      game.ball.vx = 0;
      game.ball.vy = 0;
    }
  }

  function updateBall() {
    const ball = game.ball;

    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.y - BALL_SIZE / 2 <= 0) {
      ball.y = BALL_SIZE / 2;
      ball.vy = Math.abs(ball.vy);
    }
    if (ball.y + BALL_SIZE / 2 >= CANVAS_HEIGHT) {
      ball.y = CANVAS_HEIGHT - BALL_SIZE / 2;
      ball.vy = -Math.abs(ball.vy);
    }

    const leftPaddle = game.paddles.left;
    if (
      ball.vx < 0 &&
      ball.x - BALL_SIZE / 2 <= PADDLE_MARGIN + PADDLE_WIDTH &&
      ball.x - BALL_SIZE / 2 >= PADDLE_MARGIN - Math.abs(ball.vx) &&
      ball.y >= leftPaddle.y - BALL_SIZE / 2 &&
      ball.y <= leftPaddle.y + PADDLE_HEIGHT + BALL_SIZE / 2
    ) {
      ball.x = PADDLE_MARGIN + PADDLE_WIDTH + BALL_SIZE / 2;
      bounceOffPaddle(leftPaddle, 1);
    }

    const rightPaddle = game.paddles.right;
    if (
      ball.vx > 0 &&
      ball.x + BALL_SIZE / 2 >= CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH &&
      ball.x + BALL_SIZE / 2 <= CANVAS_WIDTH - PADDLE_MARGIN + Math.abs(ball.vx) &&
      ball.y >= rightPaddle.y - BALL_SIZE / 2 &&
      ball.y <= rightPaddle.y + PADDLE_HEIGHT + BALL_SIZE / 2
    ) {
      ball.x = CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH - BALL_SIZE / 2;
      bounceOffPaddle(rightPaddle, -1);
    }

    if (ball.x < -BALL_SIZE) onGoal('p2');
    if (ball.x > CANVAS_WIDTH + BALL_SIZE) onGoal('p1');
  }

  function emitState() {
    const now = Date.now();
    // volatile: si un cliente va atrasado, se descartan frames viejos en vez de encolarse (evita lag acumulado)
    pong.volatile.emit('gameState', {
      ball: { x: Math.round(game.ball.x * 10) / 10, y: Math.round(game.ball.y * 10) / 10 },
      paddles: {
        left: { y: Math.round(game.paddles.left.y * 10) / 10 },
        right: { y: Math.round(game.paddles.right.y * 10) / 10 },
      },
      score: game.score,
      status: game.status,
      countdown: game.status === 'countdown' ? Math.max(0, Math.ceil((game.countdownUntil - now) / 1000)) : 0,
      restartIn: game.status === 'gameover' ? Math.max(0, Math.ceil((game.restartAt - now) / 1000)) : 0,
      winner: game.winner,
    });
  }

  function gameLoop() {
    const now = Date.now();

    if (game.status === 'countdown') {
      updatePaddles();
      if (now >= game.countdownUntil) {
        game.status = 'playing';
        launchBall(game.pendingServe || 1);
      }
    } else if (game.status === 'playing') {
      updatePaddles();
      updateBall();
    } else if (game.status === 'gameover') {
      if (now >= game.restartAt && player1Id && player2Id) {
        startMatch();
      }
    } else if (game.status === 'waiting') {
      updatePaddles();
    }

    emitState();
  }

  function startGameLoop() {
    if (gameLoopInterval) return;
    gameLoopInterval = setInterval(gameLoop, TICK_RATE);
  }

  function stopGameLoop() {
    if (gameLoopInterval) {
      clearInterval(gameLoopInterval);
      gameLoopInterval = null;
    }
  }

  function broadcastRoles() {
    const spectators = Object.keys(players).filter(
      (id) => id !== player1Id && id !== player2Id
    ).length;
    for (const [id, player] of Object.entries(players)) {
      let role = 'spectator';
      if (id === player1Id) role = 'player1';
      else if (id === player2Id) role = 'player2';
      player.socket.emit('role', { role, spectators });
    }
  }

  pong.on('connection', (socket) => {
    console.log(`Pong: connected ${socket.id}`);

    players[socket.id] = { socket, input: { up: false, down: false } };

    if (!player1Id) {
      player1Id = socket.id;
    } else if (!player2Id) {
      player2Id = socket.id;
      startMatch();
    }

    startGameLoop();
    broadcastRoles();

    socket.on('movePaddle', (data) => {
      const player = players[socket.id];
      if (!player) return;
      if (socket.id !== player1Id && socket.id !== player2Id) return;

      if (data && typeof data.targetY === 'number' && isFinite(data.targetY)) {
        player.input = { targetY: clamp(data.targetY, 0, CANVAS_HEIGHT) };
      } else if (data) {
        player.input = {
          up: data.direction === 'up',
          down: data.direction === 'down',
        };
      }
    });

    // medicion de latencia: el cliente envia un ping y mide el tiempo del ack
    socket.on('latency', (cb) => {
      if (typeof cb === 'function') cb();
    });

    socket.on('disconnect', () => {
      console.log(`Pong: disconnected ${socket.id}`);
      delete players[socket.id];

      if (Object.keys(players).length === 0) {
        stopGameLoop();
        player1Id = null;
        player2Id = null;
        game = createGameState();
        return;
      }

      if (socket.id === player1Id || socket.id === player2Id) {
        game = createGameState();
        player1Id = null;
        player2Id = null;

        const remaining = Object.keys(players);
        if (remaining.length >= 1) player1Id = remaining[0];
        if (remaining.length >= 2) player2Id = remaining[1];

        if (player1Id && player2Id) {
          startMatch();
        }
        broadcastRoles();
      } else {
        broadcastRoles();
      }
    });
  });
};
