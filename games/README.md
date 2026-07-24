# games/

Cada juego del arcade vive en su propia carpeta. Por ahora: `games/pong/`, `games/snake/`,
`games/cascada/` y `games/buscaminas/`.

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

Snake, Cascada y Buscaminas, de hecho, tienen un modo de cada tipo a la vez: `solo.js` es 100%
estático (ni siquiera abre un socket), y `duo.js`/`coop.js` + `server.js` son en tiempo real,
usando el mismo patrón que Pong. El detalle completo de ese patrón compartido — y de las
excepciones que introduce Buscaminas (cooperativo en vez de 1v1, sin loop porque nada se mueve
solo) — está en
[`docs/aprende/14-logica-de-los-juegos-en-tiempo-real.md`](../docs/aprende/14-logica-de-los-juegos-en-tiempo-real.md)
— léelo antes de armar el próximo juego con servidor, para copiar lo que ya funciona en vez de
reinventarlo.
