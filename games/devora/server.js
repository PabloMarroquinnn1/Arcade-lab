const WORLD_SIZE = 500;
const TICK_MS = 50; // 20 veces por segundo
const PELLET_COUNT = 50;
const PELLET_RADIUS = 5;
const PELLET_MASS_GAIN = 3;
const START_MASS = 20;
const EAT_ADVANTAGE = 1.15; // hay que ser 15% mas grande para comerse a alguien
const EAT_TRANSFER = 0.6; // cuanto de la masa de la victima se lleva quien come
const RESPAWN_DELAY_MS = 2000;

function radiusFor(mass) {
  return 10 + Math.sqrt(mass) * 2.2;
}

function speedFor(mass) {
  return Math.max(1.2, 4.5 - radiusFor(mass) * 0.03);
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomPos(marginR) {
  return {
    x: marginR + Math.random() * (WORLD_SIZE - marginR * 2),
    y: marginR + Math.random() * (WORLD_SIZE - marginR * 2),
  };
}

function spawnPellet() {
  return { ...randomPos(PELLET_RADIUS), r: PELLET_RADIUS };
}

// Namespace propio ('/devora'), pero SIN salas — a diferencia de Trivia y
// Dibuja y Adivina, aca no hay partidas separadas por codigo: todo el que
// se conecta entra al MISMO mundo compartido, como Buscaminas, pero con un
// loop de fisica continua (como Pong) en vez de reaccionar solo a clics.
module.exports = function attachDevora(io) {
  const devora = io.of('/devora');

  const players = {};
  const pellets = Array.from({ length: PELLET_COUNT }, spawnPellet);
  let loopInterval = null;

  function randomColor() {
    return `hsl(${Math.floor(Math.random() * 360)}, 85%, 55%)`;
  }

  function spawnPlayer(nombre) {
    const pos = randomPos(radiusFor(START_MASS));
    return {
      nombre,
      x: pos.x,
      y: pos.y,
      targetX: pos.x,
      targetY: pos.y,
      mass: START_MASS,
      color: randomColor(),
      alive: true,
    };
  }

  function killPlayer(id) {
    const p = players[id];
    if (!p) return;
    p.alive = false;
    setTimeout(() => {
      const stillHere = players[id];
      if (!stillHere) return; // se desconecto mientras esperaba para revivir
      const pos = randomPos(radiusFor(START_MASS));
      stillHere.alive = true;
      stillHere.mass = START_MASS;
      stillHere.x = pos.x;
      stillHere.y = pos.y;
      stillHere.targetX = pos.x;
      stillHere.targetY = pos.y;
    }, RESPAWN_DELAY_MS);
  }

  function tick() {
    const alive = Object.entries(players).filter(([, p]) => p.alive);

    for (const [, p] of alive) {
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const d = Math.hypot(dx, dy);
      const step = speedFor(p.mass);
      if (d > step) {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      } else {
        p.x = p.targetX;
        p.y = p.targetY;
      }
      const r = radiusFor(p.mass);
      p.x = clamp(p.x, r, WORLD_SIZE - r);
      p.y = clamp(p.y, r, WORLD_SIZE - r);
    }

    for (const [, p] of alive) {
      const r = radiusFor(p.mass);
      for (let i = 0; i < pellets.length; i++) {
        const pellet = pellets[i];
        if (dist(p.x, p.y, pellet.x, pellet.y) < r + pellet.r * 0.3) {
          p.mass += PELLET_MASS_GAIN;
          pellets[i] = spawnPellet();
        }
      }
    }

    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const [idA, a] = alive[i];
        const [idB, b] = alive[j];
        if (!a.alive || !b.alive) continue; // uno ya fue comido en esta misma vuelta
        const rA = radiusFor(a.mass);
        const rB = radiusFor(b.mass);
        if (dist(a.x, a.y, b.x, b.y) >= rA * 0.5 + rB * 0.5) continue;
        if (a.mass > b.mass * EAT_ADVANTAGE) {
          a.mass += b.mass * EAT_TRANSFER;
          killPlayer(idB);
        } else if (b.mass > a.mass * EAT_ADVANTAGE) {
          b.mass += a.mass * EAT_TRANSFER;
          killPlayer(idA);
        }
      }
    }

    emitState();
  }

  function emitState() {
    devora.volatile.emit('gameState', {
      jugadores: Object.entries(players).map(([id, p]) => ({
        id,
        nombre: p.nombre,
        x: p.x,
        y: p.y,
        mass: p.mass,
        color: p.color,
        alive: p.alive,
      })),
      pellets,
    });
  }

  function startLoop() {
    if (loopInterval) return;
    loopInterval = setInterval(tick, TICK_MS);
  }

  function stopLoop() {
    if (loopInterval) {
      clearInterval(loopInterval);
      loopInterval = null;
    }
  }

  devora.on('connection', (socket) => {
    console.log(`Devora: connected ${socket.id}`);

    socket.on('unirse', (data) => {
      const nombre = (data && data.nombre ? String(data.nombre) : 'Jugador').slice(0, 20);
      players[socket.id] = spawnPlayer(nombre);
      socket.emit('unido', { id: socket.id });
      startLoop();
    });

    socket.on('mover', (data) => {
      const p = players[socket.id];
      if (!p || !p.alive) return;
      if (typeof data?.x !== 'number' || typeof data?.y !== 'number') return;
      p.targetX = clamp(data.x, 0, WORLD_SIZE);
      p.targetY = clamp(data.y, 0, WORLD_SIZE);
    });

    socket.on('latency', (cb) => {
      if (typeof cb === 'function') cb();
    });

    socket.on('disconnect', () => {
      console.log(`Devora: disconnected ${socket.id}`);
      delete players[socket.id];
      if (Object.keys(players).length === 0) stopLoop();
    });
  });
};
