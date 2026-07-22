const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'hub')));
app.use('/games', express.static(path.join(__dirname, 'games')));

// API REST real (no de juguete): sirve la lista de juegos publicados.
// docs/aprende/03-que-es-rest.md la usa como ejemplo que puedes probar en vivo.
app.get('/api/juegos', (req, res) => {
  const gamesPath = path.join(__dirname, 'hub', 'games.json');
  fs.readFile(gamesPath, 'utf-8', (err, data) => {
    if (err) return res.status(500).json({ error: 'No se pudo leer la lista de juegos' });
    res.json(JSON.parse(data));
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Arcade Lab corriendo en http://localhost:${PORT}`);
});
