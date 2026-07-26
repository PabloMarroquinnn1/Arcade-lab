# 16 – Bugs de seguridad reales de este repo (y qué aprender de ellos)

Hicimos una revisión de seguridad de los 9 juegos y encontramos tres bugs reales, ya corregidos, que
valen más como ejemplo que cualquier caso inventado — pasaron en este mismo código. Los tres tienen
la misma raíz: **confiar en que un input del cliente va a tener la forma que esperás**, sin
validarlo.

## El contexto: un solo proceso para los 9 juegos

Por las limitaciones de RAM del servidor (ver [12 – Docker y despliegue](12-docker-y-despliegue.md)),
los 9 juegos corren en un único proceso de Node (`server.js`, raíz), cada uno en su propio namespace
de Socket.IO (ver [14](14-logica-de-los-juegos-en-tiempo-real.md)). Es genial para el uso de
memoria, pero tiene una consecuencia importante: **un bug que tira abajo el proceso se lleva puesto
TODO**, no solo el juego donde pasó. Si a Blastzone se le escapa una excepción sin capturar, Pong,
Snake y los otros 7 juegos también se caen — aunque el bug no tenga nada que ver con ellos. Por eso
los tres bugs de abajo se tratan como serios, aunque cada uno por separado suene chico.

## Bug 1: un objeto plano indexado con una clave que no elegís vos

`games/blastzone/server.js` tenía esto:

```js
const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

socket.on('move', (data) => {
  const dir = data && DIRS[data.direction]; // data.direction lo manda el cliente
  if (!dir) return;
  tryMove(state.p1, dir[0], dir[1]);
});
```

La intención es clara: si `data.direction` es uno de los 4 strings válidos, `dir` es el array de
movimiento; si no, `dir` da `undefined` y no pasa nada. El problema es que un objeto de JavaScript
**no arranca vacío** — viene con propiedades heredadas de fábrica, como `constructor`. Si alguien
manda `{ direction: 'constructor' }`, `DIRS['constructor']` no da `undefined` — da la función
`Object`, heredada del prototipo. Es *truthy*, así que pasa el `if (!dir) return`. Después, `dir[0]`
y `dir[1]` (índices que esa función no tiene) son `undefined`, y esas coordenadas `NaN` terminan en
un acceso a una posición del tablero que no existe — `TypeError` sin capturar, que en este arcade
significa: se cae el proceso entero.

Esto no es un caso hipotético — lo reprodujimos en vivo con un cliente real antes de arreglarlo.

**El arreglo**: usar un `Map` en vez de un objeto plano cuando la clave de búsqueda viene de afuera
(del cliente, de la red). Un `Map` no tiene propiedades heredadas — `mapa.get('constructor')` da
`undefined`, tal cual se espera:

```js
const DIRS = new Map([
  ['up', [-1, 0]], ['down', [1, 0]], ['left', [0, -1]], ['right', [0, 1]],
]);
const dir = data && DIRS.get(data.direction); // undefined si no es una de las 4 validas, sin trampas
```

El mismo problema, con el mismo arreglo, apareció en `games/snake/server.js` (una dirección
inválida corrompía la posición de la víbora a `NaN` para siempre, sin llegar a tirar el proceso) y
en las salas de Trivia, Dibuja y Adivina y Hundir la Flota, donde la clave insegura era el código de
sala en vez de una dirección de movimiento — ver
[15 – Estado en memoria](15-estado-en-memoria-sin-base-de-datos.md) para el detalle de ese caso.

## Bug 2: no limpiar el estado viejo antes de crear uno nuevo

Trivia, Dibuja y Adivina y Hundir la Flota dejaban que un mismo socket creara o se uniera a una sala
nueva sin sacarlo primero de la sala anterior. La sala vieja quedaba **huérfana**: nadie la
referencia salvo el propio `Map` de salas, nunca se destruye, sigue viva en RAM para siempre.

```js
socket.on('crearSala', (data) => {
  // ANTES: iba directo a crear la sala nueva, sin fijarse si este socket ya estaba en otra
  const room = createRoom(socket.id, nombre);
  // ...
});
```

Confirmamos en vivo que un segundo cliente podía seguir uniéndose a la sala "vieja" mucho después de
que su creador ya había abierto otra — prueba de que nunca se destruyó. Un cliente que llama
`crearSala` en bucle, sin desconectarse nunca, agota la RAM del proceso — que, recordá, es
**compartido por los 9 juegos**.

**El arreglo**: la función `leaveRoom(socket)` (que antes solo se llamaba al desconectarse) ahora se
llama también al principio de `crearSala` y dentro de `unirseSala`:

```js
socket.on('crearSala', (data) => {
  leaveRoom(socket); // saca al socket de cualquier sala anterior, primero
  const room = createRoom(socket.id, nombre);
  // ...
});
```

Regla práctica: si tu código tiene una función de limpieza para "cuando alguien se va"
(`disconnect`), preguntate si ese mismo estado puede volver a cambiar en algún otro momento — no
solo ahí hace falta llamarla.

## Bug 3: una excepción sin capturar apaga TODO el servidor

Node, por diseño, si una excepción se lanza dentro de un callback (como un handler de Socket.IO) y
nadie la atrapa con `try/catch` (ver [07](07-manejo-de-errores-try-catch.md)), asume que el programa
quedó en un estado que ya no puede confiar en sí mismo — y **apaga el proceso entero**. Es la causa
final del Bug 1: esa excepción de `TypeError` no tenía ningún `try/catch` alrededor, así que se
propagó hasta la raíz y tiró abajo Node.

Para una app de un solo propósito, esa reacción de Node tiene sentido: mejor un reinicio limpio que
seguir corriendo con estado corrupto. Pero acá el cálculo es distinto — **un proceso sirve 9 juegos
independientes**, así que dejar que un bug en uno tire abajo a los otros ocho es un costo enorme
comparado con el beneficio. Por eso `server.js` (raíz) tiene esta red de seguridad:

```js
// server.js
process.on('uncaughtException', (err) => {
  console.error('uncaughtException (el proceso sigue vivo):', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection (el proceso sigue vivo):', reason);
});
```

Esto **no arregla el bug** — el jugador que mandó el input raro probablemente se queda con su juego
en un estado roto hasta que recargue la página. Lo que sí hace es evitar que ese bug se lleve
puestos a los otros 8 juegos y a todos los demás jugadores conectados. Es un último recurso, no un
reemplazo de validar bien los inputs — Bug 1 y Bug 2 son los arreglos de fondo; esto es la red que
atrapa lo que a ese bug, o al próximo que se nos escape, se le escape a esa validación.

## Qué NO hacer

No uses esta red de seguridad como excusa para no validar inputs ("total ya hay una red, da igual").
Cada excepción que atrapa es, en la práctica, un jugador con el juego roto hasta que recargue la
página — sigue siendo un bug real, solo que contenido. Es el último recurso, no el primero.
