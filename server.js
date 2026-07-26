const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;

// Red de seguridad: los 9 juegos comparten este mismo proceso de Node, asi
// que si a uno se le escapa una excepcion sin capturar, la reaccion por
// defecto de Node (apagar TODO el proceso) se lleva puestos a los otros 8 y
// a cualquiera que este jugando en ellos - paso de verdad con un bug real de
// Blastzone, ver docs/aprende/16-bugs-de-seguridad-reales.md. Loguear y
// seguir vivo es peor practica que un try/catch bien puesto en el lugar
// exacto (eso NO lo reemplaza), pero como ultimo recurso evita que un input
// raro en un juego tire abajo a los demas.
process.on('uncaughtException', (err) => {
  console.error('uncaughtException (el proceso sigue vivo):', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection (el proceso sigue vivo):', reason);
});

// no-cache: el navegador revalida siempre, para no mezclar HTML/JS viejo con
// el nuevo mientras seguimos agregando juegos.
const staticOptions = {
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
};

app.use(express.static(path.join(__dirname, 'hub'), staticOptions));
app.use('/games', express.static(path.join(__dirname, 'games'), staticOptions));

// API REST real (no de juguete): sirve la lista de juegos publicados.
// docs/aprende/03-que-es-rest.md la usa como ejemplo que puedes probar en vivo.
app.get('/api/juegos', (req, res) => {
  const gamesPath = path.join(__dirname, 'hub', 'games.json');
  fs.readFile(gamesPath, 'utf-8', (err, data) => {
    if (err) return res.status(500).json({ error: 'No se pudo leer la lista de juegos' });
    res.json(JSON.parse(data));
  });
});

require('./games/pong/server')(io);
require('./games/snake/server')(io);
require('./games/cascada/server')(io);
require('./games/buscaminas/server')(io);
require('./games/blastzone/server')(io);
require('./games/trivia/server')(io);
require('./games/dibuja-y-adivina/server')(io);
require('./games/devora/server')(io);
require('./games/hundir-la-flota/server')(io);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Arcade Lab corriendo en http://localhost:${PORT}`);
});
