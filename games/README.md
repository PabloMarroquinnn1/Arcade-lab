# games/

Cada juego vive en su propia carpeta, por ejemplo `games/pong/`, `games/snake/`.

Convención:

- Si el juego es **estático** (HTML/CSS/JS puro, sin estado compartido entre jugadores), su carpeta
  se sirve directo como archivos estáticos desde `/games/<nombre>`.
- Si el juego necesita **tiempo real** (WebSocket, estado compartido entre jugadores, como Pong), su
  lógica de servidor se agrega a `server.js` bajo su propio namespace de Socket.IO, y el frontend
  igual vive en `games/<nombre>`.

Todavía no hay ningún juego migrado. El primero (Pong, migrado desde el prototipo original) se agrega
en su propia rama `feature/juego-pong`.
