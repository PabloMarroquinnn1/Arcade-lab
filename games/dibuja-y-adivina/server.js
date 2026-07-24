const fs = require('fs');
const path = require('path');

const ROUND_TIME_MS = 70000;
const RESULTS_PAUSE_MS = 5000;
const LOBBY_RESET_DELAY_MS = 8000;
const ROOM_CODE_LENGTH = 4;
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DRAWER_POINTS_PER_ACIERTO = 20;

// Reusa las mismas 12 palabras del modo solo (dibujos.json) — una sola
// fuente de palabras para todo el juego, en vez de mantener dos listas.
const WORDS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'dibujos.json'), 'utf-8')
).map((d) => d.palabra);

const ACCENTED = { a: 'aàáäâ', e: 'eèéëê', i: 'iìíïî', o: 'oòóöô', u: 'uùúüû', n: 'nñ' };

function normalize(text) {
  let result = String(text).trim().toLowerCase();
  for (const base of Object.keys(ACCENTED)) {
    for (const variant of ACCENTED[base]) {
      if (variant !== base) result = result.split(variant).join(base);
    }
  }
  return result;
}

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

// Namespace propio ('/dibuja-y-adivina') con salas, mismo patron que Trivia
// — ver docs/aprende/14. La diferencia con Trivia: aca no todos hacen lo
// mismo a la vez — en cada ronda UNA persona dibuja y el resto adivina, y
// ese rol rota entre los jugadores.
module.exports = function attachDibuja(io) {
  const dibuja = io.of('/dibuja-y-adivina');

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
      players: { [hostId]: { nombre: hostName, puntaje: 0 } },
      order: [],
      roundIndex: -1,
      drawerId: null,
      palabra: null,
      acertaron: {},
      status: 'lobby', // lobby | drawing | results | finished
      roundStartAt: 0,
      timer: null,
    };
    rooms[code] = room;
    return room;
  }

  function playersList(room) {
    return Object.entries(room.players).map(([id, p]) => ({ id, nombre: p.nombre, puntaje: p.puntaje }));
  }

  function broadcastLobby(room) {
    dibuja.to(room.code).emit('estadoSala', {
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

  function nonDrawerCount(room) {
    return Object.keys(room.players).filter((id) => id !== room.drawerId).length;
  }

  function startGame(room) {
    room.order = Object.keys(room.players);
    room.roundIndex = -1;
    for (const p of Object.values(room.players)) p.puntaje = 0;
    nextRound(room);
  }

  function nextRound(room) {
    room.roundIndex++;
    while (room.roundIndex < room.order.length && !room.players[room.order[room.roundIndex]]) {
      room.roundIndex++;
    }
    if (room.roundIndex >= room.order.length) {
      return finishGame(room);
    }

    room.drawerId = room.order[room.roundIndex];
    room.palabra = pickWord();
    room.acertaron = {};
    room.status = 'drawing';
    room.roundStartAt = Date.now();

    const drawerSocket = allSockets[room.drawerId];
    if (drawerSocket) drawerSocket.emit('tuPalabra', { palabra: room.palabra });

    dibuja.to(room.code).emit('rondaInicio', {
      dibujanteId: room.drawerId,
      dibujanteNombre: room.players[room.drawerId].nombre,
      tiempoMs: ROUND_TIME_MS,
      largoPalabra: room.palabra.length,
    });

    clearRoomTimer(room);
    room.timer = setTimeout(() => endRound(room), ROUND_TIME_MS);
  }

  function endRound(room) {
    room.status = 'results';
    dibuja.to(room.code).emit('rondaFin', {
      palabra: room.palabra,
      ranking: playersList(room).sort((a, b) => b.puntaje - a.puntaje),
    });

    clearRoomTimer(room);
    room.timer = setTimeout(() => nextRound(room), RESULTS_PAUSE_MS);
  }

  function finishGame(room) {
    room.status = 'finished';
    room.drawerId = null;
    dibuja.to(room.code).emit('partidaTerminada', {
      ranking: playersList(room).sort((a, b) => b.puntaje - a.puntaje),
    });

    clearRoomTimer(room);
    room.timer = setTimeout(() => {
      room.status = 'lobby';
      room.roundIndex = -1;
      for (const p of Object.values(room.players)) p.puntaje = 0;
      broadcastLobby(room);
    }, LOBBY_RESET_DELAY_MS);
  }

  dibuja.on('connection', (socket) => {
    console.log(`Dibuja: connected ${socket.id}`);
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

      room.players[socket.id] = { nombre, puntaje: 0 };
      socketRoom[socket.id] = room.code;
      socket.join(room.code);
      socket.emit('unidoASala', { codigo: room.code });
      broadcastLobby(room);
    });

    socket.on('empezarPartida', () => {
      const room = rooms[socketRoom[socket.id]];
      if (!room || room.hostId !== socket.id || room.status !== 'lobby') return;
      if (Object.keys(room.players).length < 2) {
        return socket.emit('errorSala', { mensaje: 'Necesitás al menos 2 jugadores para empezar.' });
      }
      startGame(room);
    });

    // ---------- Trazos en vivo: solo el dibujante puede mandarlos, y se
    // retransmiten a los demas de la sala SIN mandarselos de vuelta a quien
    // los mando (el ya los ve localmente mientras dibuja).
    socket.on('trazoInicio', (data) => {
      const room = rooms[socketRoom[socket.id]];
      if (!room || room.status !== 'drawing' || room.drawerId !== socket.id) return;
      if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') return;
      socket.to(room.code).emit('trazoInicio', { x: data.x, y: data.y });
    });

    socket.on('trazoContinua', (data) => {
      const room = rooms[socketRoom[socket.id]];
      if (!room || room.status !== 'drawing' || room.drawerId !== socket.id) return;
      if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') return;
      socket.to(room.code).emit('trazoContinua', { x: data.x, y: data.y });
    });

    socket.on('trazoFin', () => {
      const room = rooms[socketRoom[socket.id]];
      if (!room || room.status !== 'drawing' || room.drawerId !== socket.id) return;
      socket.to(room.code).emit('trazoFin');
    });

    socket.on('limpiarCanvas', () => {
      const room = rooms[socketRoom[socket.id]];
      if (!room || room.status !== 'drawing' || room.drawerId !== socket.id) return;
      socket.to(room.code).emit('limpiarCanvas');
    });

    // ---------- Chat / adivinanzas ----------
    socket.on('mensaje', (data) => {
      const room = rooms[socketRoom[socket.id]];
      if (!room || room.status !== 'drawing') return;
      if (socket.id === room.drawerId) return; // el que dibuja no chatea, para no arruinar
      if (!data || typeof data.texto !== 'string' || !data.texto.trim()) return;

      const texto = data.texto.slice(0, 100);
      const jugador = room.players[socket.id];
      if (!jugador) return;

      if (!room.acertaron[socket.id] && normalize(texto) === normalize(room.palabra)) {
        room.acertaron[socket.id] = true;
        const elapsed = Date.now() - room.roundStartAt;
        const fraction = Math.max(0, (ROUND_TIME_MS - elapsed) / ROUND_TIME_MS);
        const puntos = 100 + Math.round(fraction * 100);
        jugador.puntaje += puntos;
        if (room.players[room.drawerId]) room.players[room.drawerId].puntaje += DRAWER_POINTS_PER_ACIERTO;

        dibuja.to(room.code).emit('acierto', { nombre: jugador.nombre, puntos });

        if (Object.keys(room.acertaron).length >= nonDrawerCount(room)) {
          endRound(room);
        }
      } else {
        dibuja.to(room.code).emit('chat', { nombre: jugador.nombre, texto });
      }
    });

    socket.on('latency', (cb) => {
      if (typeof cb === 'function') cb();
    });

    socket.on('disconnect', () => {
      console.log(`Dibuja: disconnected ${socket.id}`);
      delete allSockets[socket.id];
      leaveRoom(socket);
    });

    function leaveRoom(socket) {
      const code = socketRoom[socket.id];
      if (!code) return;
      const room = rooms[code];
      delete socketRoom[socket.id];
      if (!room) return;

      const wasDrawing = room.status === 'drawing';
      const wasDrawer = room.drawerId === socket.id;

      delete room.players[socket.id];
      socket.leave(code);

      if (destroyRoomIfEmpty(room)) return;

      if (room.hostId === socket.id) {
        room.hostId = Object.keys(room.players)[0];
      }

      if (wasDrawing && wasDrawer) {
        endRound(room); // se fue quien dibujaba, cerramos la ronda ya
      } else {
        broadcastLobby(room);
      }
    }
  });
};
