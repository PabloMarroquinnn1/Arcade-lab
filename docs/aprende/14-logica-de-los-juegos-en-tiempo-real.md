# 14 – La lógica de los juegos en tiempo real (Pong, Snake y Cascada)

Con Pong, Snake (modo 2 jugadores) y Cascada (modo versus) ya construidos, acá está el patrón que
**los tres comparten** — para que cuando armes el próximo juego en tiempo real (Blastzone, Trivia,
etc.) sepas qué copiar tal cual y qué es específico de cada juego.

## El patrón, en 5 piezas

1. Un namespace de Socket.IO por juego.
2. El servidor es la única fuente de verdad (*server authority*, ver
   [11](11-arquitectura-cliente-servidor.md)).
3. Un loop a intervalo fijo que avanza el juego y manda el estado completo.
4. Roles: jugador 1 / jugador 2 / espectador, con reconexión.
5. El cliente solo manda inputs y dibuja — nunca decide el resultado.

## 1. Un namespace por juego

`server.js` (raíz) monta cada juego por separado:

```js
require('./games/pong/server')(io);
require('./games/snake/server')(io);
require('./games/cascada/server')(io);
```

Y cada uno se cuelga de su propio namespace en vez del namespace por defecto:

```js
// games/pong/server.js
module.exports = function attachPong(io) {
  const pong = io.of('/pong');
  pong.on('connection', (socket) => { /* ... */ });
```

```js
// games/snake/server.js
module.exports = function attachSnake(io) {
  const snake = io.of('/snake');
  snake.on('connection', (socket) => { /* ... */ });
```

¿Por qué? Sin namespaces, un evento `gameState` de Pong y uno de Snake serían indistinguibles para
cualquier cliente conectado — comparten el mismo servidor y el mismo puerto. El namespace (`/pong`,
`/snake`) es, en la práctica, un canal aparte por juego dentro del mismo proceso.

## 2. El servidor manda, el cliente obedece

Ninguno de los dos juegos deja que el cliente decida nada importante:

- En Pong, el cliente manda "quiero ir para arriba" (`movePaddle`); el servidor calcula la física
  de la pelota, los rebotes, y quién ganó.
- En Snake, el cliente manda "ahora voy para la izquierda" (`setDirection`); el servidor decide si
  esa víbora chocó contra la pared, contra sí misma o contra la otra.
- En Cascada, el cliente manda "rotar" o "caída rápida" (`action`); el servidor decide si esa pieza
  entra ahí, si se completó una línea, y hasta le manda basura al tablero del rival.

Si el cliente pudiera decidir el resultado, cualquiera podría hacer trampa editando el JS del
navegador. Ver [11](11-arquitectura-cliente-servidor.md).

## 3. Loop a intervalo fijo + `volatile.emit`

Los tres juegos corren un `setInterval` que avanza el juego y manda el estado completo — pero a
velocidades distintas, según lo que necesita cada uno:

```js
// Pong: 60 veces por segundo — la pelota se mueve continuo, necesita fluidez
gameLoopInterval = setInterval(gameLoop, TICK_RATE); // TICK_RATE = 1000 / 60

// Snake: cada 120ms — es un juego de grilla, no hace falta ir mas rapido que eso
gameLoopInterval = setInterval(gameLoop, TICK_MS); // TICK_MS = 120

// Cascada versus: cada 500ms, y a proposito FIJA (a diferencia del modo
// solo, que va mas rapido con cada nivel) — en un 1v1 conviene que a los
// dos les caigan las piezas igual de rapido, si no el mas lento arranca en
// desventaja
gameLoopInterval = setInterval(gameLoop, TICK_MS); // TICK_MS = 500
```

Los tres mandan el estado con `volatile.emit` en vez de `emit` normal:

```js
pong.volatile.emit('gameState', { /* ... */ });
snake.volatile.emit('gameState', { /* ... */ });
cascada.volatile.emit('gameState', { /* ... */ });
```

`volatile` le dice a Socket.IO: "si el cliente está momentáneamente desconectado o atrasado, no
guardes este mensaje en una cola para mandarlo después — descartalo". Como mandamos un estado
nuevo entero muy seguido, un frame perdido no importa (ya viene el siguiente); lo que sí importa es
que nunca se acumule una fila de estados viejos esperando a un cliente lento, porque eso generaría
lag creciente.

## 4. Roles y reconexión

El código de roles es casi idéntico entre los dos juegos — la primera persona que se conecta es
`player1`, la segunda es `player2`, el resto son espectadores:

```js
if (!player1Id) {
  player1Id = socket.id;
} else if (!player2Id) {
  player2Id = socket.id;
  startMatch(); // o startRound(), segun el juego
}
```

Y si alguno de los dos jugadores se desconecta, la partida se reinicia y los roles se reparten de
nuevo entre quienes quedan conectados — así nadie se queda "colgado" esperando a alguien que ya se
fue.

## 5. El cliente: mandar inputs, dibujar lo que llega

Acá es donde Pong se diferencia de Snake y Cascada, y por una buena razón.

**Pong** interpola: guarda los últimos snapshots del servidor y dibuja ~80ms en el pasado,
mezclando entre dos snapshots (`games/pong/client.js`, función `getRenderState`). Hace falta porque
la pelota se mueve de forma continua a 60fps — sin interpolar, cualquier variación en la llegada de
paquetes por red se ve como tirones.

**Snake y Cascada** no interpolan: dibujan directo el último estado que llegó
(`games/snake/duo.js`, `games/cascada/duo.js`). No hace falta, porque el movimiento ya es "a los
saltos" por diseño — la víbora se mueve una celda entera cada 120ms, las piezas de Cascada caen una
fila cada 500ms, así que no hay nada continuo que suavizar.

Regla práctica: si tu juego nuevo tiene movimiento continuo (algo tipo `Devora`), vas a necesitar
interpolar como Pong. Si es a grilla o por turnos (`Hundir la Flota`, `Turno`), con dibujar el
último estado alcanza, como Snake y Cascada.

## Lo que es específico de cada juego (no es parte del patrón)

- **Pong**: los ángulos de rebote, la aceleración de la pelota, la cuenta regresiva de saque.
- **Snake**: el crecimiento al comer, y la detección de choque usando `futureBody` — el cuerpo
  "tal como va a quedar" después de moverse (la cola se libera esa misma vuelta, salvo que la
  víbora esté por crecer).
- **Cascada**: la rotación de piezas (matriz 4x4 rotada, sin *wall-kick* — si al rotar no entra,
  simplemente no rota), y la mecánica de mandarle líneas de "basura" al rival cuando completás
  varias a la vez (`addGarbage` en `games/cascada/server.js`).

## Cuándo este patrón NO aplica

Los modos solo de Snake y Cascada (`games/snake/solo.js`, `games/cascada/solo.js`) no siguen nada
de esto — no hay namespace, no hay servidor, no hay roles. Es un `setInterval` corriendo directo en
el navegador, con todo el estado del juego viviendo ahí mismo. Son la comparación perfecta para la
regla de [10 – WebSockets vs HTTP](10-websockets-vs-http.md): un juego que un jugador solo puede
jugar sin sincronizar nada con nadie no necesita servidor en absoluto.
