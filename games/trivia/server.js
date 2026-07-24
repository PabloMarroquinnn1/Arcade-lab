const fs = require('fs');
const path = require('path');

const QUESTIONS_PER_ROUND = 8;
const TIME_PER_QUESTION_MS = 15000;
const RESULTS_DURATION_MS = 4000;
const LOBBY_RESET_DELAY_MS = 8000;
const ROOM_CODE_LENGTH = 4;
// Sin caracteres que se confunden entre si (I/L/1, O/0)
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const allQuestions = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'preguntas.json'), 'utf-8')
);

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Namespace propio ('/trivia'), pero ADEMAS subdividido en salas (rooms de
// Socket.IO) — varias partidas independientes corriendo al mismo tiempo
// dentro del mismo namespace. Ver docs/aprende/14 para la diferencia entre
// namespace (fijo, uno por juego) y sala (dinamica, una por partida).
module.exports = function attachTrivia(io) {
  const trivia = io.of('/trivia');

  const rooms = {}; // codigo -> room
  const socketRoom = {}; // socket.id -> codigo

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
      players: {
        [hostId]: { nombre: hostName, puntaje: 0 },
      },
      questions: shuffle(allQuestions).slice(0, QUESTIONS_PER_ROUND),
      currentIndex: -1,
      status: 'lobby', // lobby | question | results | finished
      questionStartAt: 0,
      timer: null,
      answeredThisQuestion: {}, // socket.id -> true
    };
    rooms[code] = room;
    return room;
  }

  function playersList(room) {
    return Object.entries(room.players).map(([id, p]) => ({ id, nombre: p.nombre, puntaje: p.puntaje }));
  }

  function broadcastLobby(room) {
    trivia.to(room.code).emit('estadoSala', {
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

  function startQuestion(room) {
    room.currentIndex++;
    if (room.currentIndex >= room.questions.length) {
      return finishRoom(room);
    }

    room.status = 'question';
    room.questionStartAt = Date.now();
    room.answeredThisQuestion = {};

    const question = room.questions[room.currentIndex];
    trivia.to(room.code).emit('pregunta', {
      indice: room.currentIndex,
      total: room.questions.length,
      pregunta: question.pregunta,
      opciones: question.opciones, // OJO: nunca mandamos "correcta" aca
      tiempoMs: TIME_PER_QUESTION_MS,
    });

    clearRoomTimer(room);
    room.timer = setTimeout(() => showResults(room), TIME_PER_QUESTION_MS);
  }

  function showResults(room) {
    room.status = 'results';
    const question = room.questions[room.currentIndex];
    trivia.to(room.code).emit('resultados', {
      correcta: question.correcta,
      ranking: playersList(room).sort((a, b) => b.puntaje - a.puntaje),
    });

    clearRoomTimer(room);
    room.timer = setTimeout(() => startQuestion(room), RESULTS_DURATION_MS);
  }

  function finishRoom(room) {
    room.status = 'finished';
    trivia.to(room.code).emit('partidaTerminada', {
      ranking: playersList(room).sort((a, b) => b.puntaje - a.puntaje),
    });

    clearRoomTimer(room);
    room.timer = setTimeout(() => {
      room.status = 'lobby';
      room.currentIndex = -1;
      for (const p of Object.values(room.players)) p.puntaje = 0;
      broadcastLobby(room);
    }, LOBBY_RESET_DELAY_MS);
  }

  trivia.on('connection', (socket) => {
    console.log(`Trivia: connected ${socket.id}`);

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
      startQuestion(room);
    });

    socket.on('responder', (data) => {
      const room = rooms[socketRoom[socket.id]];
      if (!room || room.status !== 'question') return;
      if (room.answeredThisQuestion[socket.id]) return; // solo cuenta la primera respuesta
      if (!data || !Number.isInteger(data.opcionIndex)) return;

      room.answeredThisQuestion[socket.id] = true;
      const question = room.questions[room.currentIndex];
      if (data.opcionIndex === question.correcta) {
        const elapsed = Date.now() - room.questionStartAt;
        const fraction = Math.max(0, (TIME_PER_QUESTION_MS - elapsed) / TIME_PER_QUESTION_MS);
        const puntos = 100 + Math.round(fraction * 100);
        room.players[socket.id].puntaje += puntos;
      }
    });

    socket.on('salirSala', () => {
      leaveRoom(socket);
    });

    socket.on('latency', (cb) => {
      if (typeof cb === 'function') cb();
    });

    socket.on('disconnect', () => {
      console.log(`Trivia: disconnected ${socket.id}`);
      leaveRoom(socket);
    });

    function leaveRoom(socket) {
      const code = socketRoom[socket.id];
      if (!code) return;
      const room = rooms[code];
      delete socketRoom[socket.id];
      if (!room) return;

      delete room.players[socket.id];
      socket.leave(code);

      if (destroyRoomIfEmpty(room)) return;

      if (room.hostId === socket.id) {
        room.hostId = Object.keys(room.players)[0];
      }
      broadcastLobby(room);
    }
  });
};
