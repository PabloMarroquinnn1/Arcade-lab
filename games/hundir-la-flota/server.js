const SIZE = 10;
const SHIP_SIZES = [4, 3, 3, 2];
const ROOM_CODE_LENGTH = 4;
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RESULT_PAUSE_MS = 6000;

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
  if (shipId === null) return 'miss';
  const ship = fleet.ships[shipId];
  ship.hits++;
  if (ship.hits >= ship.size) {
    ship.sunk = true;
    return 'sunk';
  }
  return 'hit';
}

function allSunk(fleet) {
  return fleet.ships.every((s) => s.sunk);
}

// Namespace propio ('/hundir-la-flota') con salas de 2, mismo patron que
// Trivia — ver docs/aprende/14. Sin loop: es por turnos, nada avanza solo
// con el tiempo (como Buscaminas). La pieza nueva aca es "estado privado":
// el servidor calcula las dos flotas pero nunca le manda a un jugador la
// del otro, salvo lo que ya impacto.
module.exports = function attachFlota(io) {
  const flota = io.of('/hundir-la-flota');

  const rooms = {};
  const socketRoom = {};
  const allSockets = {};

  function generateRoomCode() {
    let code;
    do {
      code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
      }
    } while (rooms[code]);
    return code;
  }

  function createRoom(hostId, hostName) {
    const code = generateRoomCode();
    const room = {
      code,
      hostId,
      players: { [hostId]: { nombre: hostName, fleet: null, fired: null } },
      order: [],
      turnId: null,
      status: 'lobby', // lobby | playing | finished
      winner: null,
      timer: null,
    };
    rooms[code] = room;
    return room;
  }

  function playersList(room) {
    return Object.entries(room.players).map(([id, p]) => ({ id, nombre: p.nombre }));
  }

  function broadcastLobby(room) {
    flota.to(room.code).emit('estadoSala', {
      codigo: room.code,
      hostId: room.hostId,
      jugadores: playersList(room),
      status: room.status,
    });
  }

  function clearRoomTimer(room) {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
  }

  function destroyRoomIfEmpty(room) {
    if (Object.keys(room.players).length === 0) {
      clearRoomTimer(room);
      delete rooms[room.code];
      return true;
    }
    return false;
  }

  function opponentId(room, id) {
    return room.order.find((x) => x !== id);
  }

  function startGame(room) {
    room.order = Object.keys(room.players);
    for (const id of room.order) {
      room.players[id].fleet = placeFleet();
      room.players[id].fired = emptyGrid();
    }
    room.turnId = room.order[0];
    room.status = 'playing';
    room.winner = null;

    for (const id of room.order) {
      const sock = allSockets[id];
      if (sock) sock.emit('tuFlota', { grid: room.players[id].fleet.grid });
    }

    flota.to(room.code).emit('partidaInicio', {
      turnoDe: room.turnId,
      jugadores: playersList(room),
    });
  }

  function endGame(room, winnerId, motivo) {
    room.status = 'finished';
    room.winner = winnerId;
    flota.to(room.code).emit('partidaTerminada', {
      ganador: winnerId,
      motivo, // 'hundida' | 'abandono'
      flotas: room.order.reduce((acc, id) => {
        acc[id] = room.players[id].fleet ? room.players[id].fleet.grid : null;
        return acc;
      }, {}),
    });

    clearRoomTimer(room);
    room.timer = setTimeout(() => {
      room.status = 'lobby';
      room.order = [];
      room.turnId = null;
      room.winner = null;
      for (const p of Object.values(room.players)) {
        p.fleet = null;
        p.fired = null;
      }
      broadcastLobby(room);
    }, RESULT_PAUSE_MS);
  }

  flota.on('connection', (socket) => {
    console.log(`Flota: connected ${socket.id}`);
    allSockets[socket.id] = socket;

    socket.on('crearSala', (data) => {
      const nombre = (data && data.nombre ? String(data.nombre) : 'Jugador').slice(0, 20);
      const room = createRoom(socket.id, nombre);
      socketRoom[socket.id] = room.code;
      socket.join(room.code);
      socket.emit('salaCreada', { codigo: room.code });
      broadcastLobby(room);
    });

    socket.on('unirseSala', (data) => {
      const codigo = data && typeof data.codigo === 'string' ? data.codigo.toUpperCase() : '';
      const nombre = (data && data.nombre ? String(data.nombre) : 'Jugador').slice(0, 20);
      const room = rooms[codigo];

      if (!room) return socket.emit('errorSala', { mensaje: 'Esa sala no existe.' });
      if (room.status !== 'lobby') return socket.emit('errorSala', { mensaje: 'Esa partida ya empezó.' });
      if (Object.keys(room.players).length >= 2) {
        return socket.emit('errorSala', { mensaje: 'Esa sala ya tiene 2 jugadores.' });
      }

      room.players[socket.id] = { nombre, fleet: null, fired: null };
      socketRoom[socket.id] = room.code;
      socket.join(room.code);
      socket.emit('unidoASala', { codigo: room.code });
      broadcastLobby(room);
    });

    socket.on('empezarPartida', () => {
      const room = rooms[socketRoom[socket.id]];
      if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
      if (Object.keys(room.players).length !== 2) {
        return socket.emit('errorSala', { mensaje: 'Necesitás exactamente 2 jugadores para empezar.' });
      }
      startGame(room);
    });

    socket.on('disparar', (data) => {
      const room = rooms[socketRoom[socket.id]];
      if (!room || room.status !== 'playing' || room.turnId !== socket.id) return;
      if (!data || !Number.isInteger(data.r) || !Number.isInteger(data.c)) return;
      const { r, c } = data;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;

      const targetId = opponentId(room, socket.id);
      const target = room.players[targetId];
      if (target.fired[r][c]) return; // ya se disparo ahi

      const result = fireAt(target.fleet, r, c);
      target.fired[r][c] = result;

      flota.to(room.code).emit('resultadoDisparo', { r, c, result, disparadoPor: socket.id });

      if (allSunk(target.fleet)) {
        return endGame(room, socket.id, 'hundida');
      }

      room.turnId = targetId;
      flota.to(room.code).emit('cambioTurno', { turnoDe: room.turnId });
    });

    socket.on('latency', (cb) => {
      if (typeof cb === 'function') cb();
    });

    socket.on('disconnect', () => {
      console.log(`Flota: disconnected ${socket.id}`);
      delete allSockets[socket.id];
      leaveRoom(socket);
    });

    function leaveRoom(socket) {
      const code = socketRoom[socket.id];
      if (!code) return;
      const room = rooms[code];
      delete socketRoom[socket.id];
      if (!room) return;

      const wasPlaying = room.status === 'playing';
      const remaining = opponentId(room, socket.id);

      delete room.players[socket.id];
      socket.leave(code);

      if (destroyRoomIfEmpty(room)) return;

      if (room.hostId === socket.id) {
        room.hostId = Object.keys(room.players)[0];
      }

      if (wasPlaying && remaining && room.players[remaining]) {
        endGame(room, remaining, 'abandono');
      } else {
        broadcastLobby(room);
      }
    }
  });
};
