const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;

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

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Arcade Lab corriendo en http://localhost:${PORT}`);
});
