# games/

Acá va a vivir cada juego del arcade, uno por carpeta: `games/pong/`, `games/snake/`, etc. Por
ahora está vacía porque todavía no migramos ninguno — la carpeta existe para dejar claro dónde van
a ir.

## Dos tipos de juego, según si necesitan un servidor o no

No todos los juegos funcionan igual por dentro. Hay dos casos, y la diferencia importa para saber
dónde va el código de cada uno:

- **Estático**: juegos de un solo jugador (o donde no hace falta que dos personas vean exactamente
  lo mismo al mismo tiempo). Todo el código — HTML, CSS y JS — vive en `games/<nombre>/`, y el
  servidor solo se encarga de entregarle esos archivos al navegador cuando alguien entra a
  `/games/<nombre>`. No hay nada corriendo "detrás" mientras se juega.
- **En tiempo real**: juegos donde dos o más jugadores comparten el mismo estado (como Pong, donde
  ambos ven la misma pelota moviéndose al instante). Estos necesitan que el servidor esté
  calculando el juego todo el tiempo y avisándole a cada jugador qué está pasando, usando
  WebSocket en vez de páginas normales — ver
  [`docs/aprende/10-websockets-vs-http.md`](../docs/aprende/10-websockets-vs-http.md). Por eso, además
  del frontend en `games/<nombre>/`, estos juegos también agregan su lógica de servidor dentro de
  `server.js`.

El primero que vamos a migrar es Pong (el prototipo original que ya funcionaba), como ejemplo de
juego en tiempo real.
