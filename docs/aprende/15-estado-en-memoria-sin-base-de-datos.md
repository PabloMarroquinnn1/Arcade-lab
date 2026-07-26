# 15 – Estado en memoria: cómo funciona todo esto sin base de datos

Ningún juego de este arcade usa una base de datos, y sin embargo Pong sabe quién es cada jugador,
Cascada sabe en qué nivel vas, y Trivia sabe qué sala existe con qué código y quién es el
anfitrión. ¿Dónde vive todo eso? En la memoria RAM del propio proceso de Node, mientras está
corriendo. Nada más.

## Es solo una variable de JS

`games/pong/server.js` tiene esto arriba de todo:

```js
let player1Id = null;
let player2Id = null;
```

Eso no es una base de datos ni algo especial — es una variable común de JavaScript. Vive en la
memoria del proceso de Node desde que arranca `server.js` hasta que se apaga. Mientras el servidor
está prendido, esa variable **existe y se puede leer y modificar** desde cualquier función de ese
archivo. Si el servidor se reinicia (o se cae), esa variable se pierde — vuelve a su valor inicial
la próxima vez que arranque.

Trivia usa el mismo truco, un poco más elaborado: en vez de dos variables sueltas, una estructura
que agrupa todas las salas activas:

```js
// games/trivia/server.js
const rooms = new Map(); // codigo -> { code, hostId, players, questions, ... }
```

`rooms.get('4KJ3')` es, literalmente, ir a buscar a ese objeto ahí sentado en RAM. Crear una sala es
agregarle una entrada (`rooms.set(codigo, room)`); unirse es buscarla (`rooms.get(codigo)`); cuando
la última persona se va, se borra (`rooms.delete(codigo)`) para no dejar basura acumulándose en
memoria para siempre.

**¿Por qué `Map` y no un objeto `{}`?** Acá el código de sala no lo elige el servidor — lo escribe
el cliente cuando llama `unirseSala`. Un objeto plano de JS viene con propiedades heredadas de
fábrica (`constructor`, `toString`, `__proto__`...), así que si alguien manda como código de sala el
string `"constructor"`, `rooms['constructor']` no da `undefined` como uno esperaría de una sala que
no existe — da la función `Object` heredada del prototipo. El código que sigue, pensado para trabajar
con una sala de verdad, se rompe de formas raras en el mejor caso, o puede llegar a tirar abajo el
proceso entero en el peor (justamente le pasó a este arcade: ver el bug real corregido en
`games/blastzone/server.js` y `games/snake/server.js`, mismo problema pero con una dirección de
movimiento en vez de un código de sala). Un `Map` no tiene propiedades heredadas — `rooms.get('constructor')`
da `undefined`, tal cual se espera. Regla práctica: si la clave para buscar algo viene de afuera
(un cliente, la red), usá `Map`; si la clave la elegís vos en el código, un objeto `{}` alcanza.

## Por qué esto alcanza (y cuándo no)

Una base de datos existe para guardar información que tiene que **sobrevivir** — a un reinicio del
servidor, a que pase una semana, a que quieras consultarla desde otro proceso. Nada de lo que
construimos hasta ahora necesita eso: una partida de Pong, una sala de Trivia, existen solo
mientras esa gente está jugando. Si el servidor se reinicia a mitad de una partida, lo peor que
pasa es que hay que volver a conectarse — no es un problema grave para un arcade casero.

Vas a necesitar una base de datos de verdad recién cuando algo tenga que:

- **Sobrevivir un reinicio del servidor** (un ranking global que no se resetea cada vez que hacés
  `docker compose up --build -d`).
- **Compartirse entre sesiones separadas en el tiempo** (por ejemplo, un progreso de juego que
  tenés que poder retomar mañana donde lo dejaste).
- **Ser demasiado grande para tener sentido en RAM** (no es nuestro caso — ni 1000 salas de Trivia
  ocupan memoria como para preocuparse).

Ver también [09 – localStorage](09-localstorage.md#localstorage-vs-base-de-datos): la tabla de ahí
compara `localStorage` con "servidor + base de datos", pero ojo — el **servidor solo** (sin base de
datos, como todo lo que armamos hasta acá) ya alcanza para compartir estado en tiempo real entre
varios jugadores. La base de datos entra recién cuando ese estado necesita persistir.

## Objeto, Map o array: cuál usar para qué

La regla, juntando lo de arriba:

- **Objeto**, cuando vas a **buscar algo por una clave que ya conocés y que elegís vos en el
  código** (el id de un socket, por ejemplo — lo genera Socket.IO, no lo escribe un cliente
  malicioso). `room.players[socketId]` es instantáneo, no importa si hay 3 jugadores o 3000.
- **`Map`**, cuando la clave para buscar es la misma idea (búsqueda instantánea por clave), pero esa
  clave **viene de afuera** — la escribe un cliente, como el código de sala. Ver la sección de
  arriba.
- **Array**, cuando te importa el **orden**, o necesitás recorrer/filtrar/ordenar todo el
  conjunto.

Trivia usa las dos, cada una donde corresponde:

```js
// Objeto: guardar jugadores por id, para poder buscar "este jugador" al toque
room.players = { 'abc123': { nombre: 'Ana', puntaje: 200 }, 'def456': { nombre: 'Luis', puntaje: 150 } };

// Array: recien cuando hace falta ORDENAR para armar el ranking
function playersList(room) {
  return Object.entries(room.players).map(([id, p]) => ({ id, nombre: p.nombre, puntaje: p.puntaje }));
}
playersList(room).sort((a, b) => b.puntaje - a.puntaje);
```

`Object.entries(objeto)` convierte un objeto en un array de pares `[clave, valor]` — es el puente
que se usa acá para pasar de "buscar rápido por id" a "ordenar todo por puntaje".

## Quién es el host: un dato más, no magia

No hay ningún mecanismo especial de "permisos". `hostId` es un campo más, guardado junto con el
resto de la sala, con el id del socket que la creó:

```js
room.hostId = socket.id;
// ...
socket.on('empezarPartida', () => {
  if (room.hostId !== socket.id) return; // no sos el host, no pasa nada
  startQuestion(room);
});
```

Es una comparación de texto. Si esa persona se desconecta, otra línea de código le reasigna
`hostId` a alguien que siga en la sala — de nuevo, solo reescribir un campo de un objeto en
memoria.

## Push, no pull

Cuando alguien responde una pregunta, el servidor no anda "preguntando" cada tanto si hay algo
nuevo — WebSocket funciona al revés (ver [10](10-websockets-vs-http.md)): el evento llega solo, y
se procesa en el momento:

```js
socket.on('responder', (data) => {
  // esto se ejecuta EN EL INSTANTE en que llega la respuesta, no en un chequeo periodico
  room.players[socket.id].puntaje += puntos;
});
```

Nada de "pull" (ir a buscar) — es "push" (te avisan apenas pasa). Es la misma idea de fondo que ya
viste en [10](10-websockets-vs-http.md) al comparar WebSocket con HTTP polling.
