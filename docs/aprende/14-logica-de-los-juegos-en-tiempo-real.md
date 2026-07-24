# 14 – La lógica de los juegos en tiempo real (Pong, Snake, Cascada, Buscaminas y Blastzone)

Con estos cinco juegos ya construidos, acá está el patrón que **comparten** — para que cuando
armes el próximo juego en tiempo real (Trivia, Turno, etc.) sepas qué copiar tal cual y qué es
específico de cada juego. Buscaminas rompe dos de las reglas a propósito — esas excepciones están
marcadas más abajo, léelas también. Blastzone, en cambio, es el que más se parece al patrón base:
sirve como buen punto de partida si tu próximo juego es competitivo 1v1 con algo que avanza solo
con el tiempo (acá, la mecha de las bombas).

## El patrón, en 5 piezas

1. Un namespace de Socket.IO por juego.
2. El servidor es la única fuente de verdad (*server authority*, ver
   [11](11-arquitectura-cliente-servidor.md)).
3. Un loop a intervalo fijo que avanza el juego y manda el estado completo — **salvo que el juego
   no tenga nada que avanzar solo** (ver la sección 6).
4. Roles: jugador 1 / jugador 2 / espectador, con reconexión — **salvo que el juego sea
   cooperativo entre N personas en vez de competitivo 1v1** (ver la sección 4).
5. El cliente solo manda inputs y dibuja — nunca decide el resultado.

## 1. Un namespace por juego

`server.js` (raíz) monta cada juego por separado:

```js
require('./games/pong/server')(io);
require('./games/snake/server')(io);
require('./games/cascada/server')(io);
require('./games/buscaminas/server')(io);
require('./games/blastzone/server')(io);
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
- En Buscaminas, el cliente manda "destapar esta celda" (`reveal`); el servidor decide qué hay ahí
  y se lo manda de vuelta — el cliente ni siquiera **sabe** dónde están las minas hasta que se
  revelan (`serializeBoard` en `games/buscaminas/server.js` nunca manda esa info de antemano).
- En Blastzone, el cliente manda "muevete para arriba" (`move`); el servidor revisa que no haya
  pasado muy poco tiempo desde tu último movimiento (`MOVE_COOLDOWN_MS`) antes de moverte. Sin ese
  chequeo, un cliente modificado podría mandar `move` sin parar y moverse más rápido que todos —
  justo lo que describe `games.json` para este juego: *"el servidor manda para que nadie haga
  trampa con su posición"*.

Si el cliente pudiera decidir el resultado, cualquiera podría hacer trampa editando el JS del
navegador. Ver [11](11-arquitectura-cliente-servidor.md).

## 3. Loop a intervalo fijo + `volatile.emit`

Pong, Snake, Cascada y Blastzone corren un `setInterval` que avanza el juego y manda el estado
completo — pero a velocidades distintas, según lo que necesita cada uno:

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

// Blastzone: cada 100ms — no mueve nada por si solo, pero necesita revisar
// seguido si a alguna bomba ya se le acabo la mecha
gameLoopInterval = setInterval(gameLoop, TICK_MS); // TICK_MS = 100
```

Todos mandan el estado con `volatile.emit` en vez de `emit` normal:

```js
pong.volatile.emit('gameState', { /* ... */ });
snake.volatile.emit('gameState', { /* ... */ });
cascada.volatile.emit('gameState', { /* ... */ });
blastzone.volatile.emit('gameState', { /* ... */ });
```

`volatile` le dice a Socket.IO: "si el cliente está momentáneamente desconectado o atrasado, no
guardes este mensaje en una cola para mandarlo después — descartalo". Como mandamos un estado
nuevo entero muy seguido, un frame perdido no importa (ya viene el siguiente); lo que sí importa es
que nunca se acumule una fila de estados viejos esperando a un cliente lento, porque eso generaría
lag creciente.

**Buscaminas usa `emit` normal (sin `volatile`) para el estado del tablero, a propósito:**

```js
// games/buscaminas/server.js
buscaminas.emit('gameState', { /* ... */ }); // SIN volatile
```

Acá cada actualización es un evento puntual e importante (alguien destapó una celda), no un stream
constante — si se pierde uno, no "ya viene el siguiente" enseguida, porque nada avanza solo. Perder
ese mensaje significaría que un jugador se queda viendo un tablero desactualizado hasta el próximo
clic de alguien. Por eso ahí sí conviene la entrega garantizada de `emit` normal.

Los cursores de Buscaminas, en cambio, **sí** usan `volatile` — son puramente cosméticos, se mandan
muy seguido, y perder una posición intermedia del mouse de nadie no importa:

```js
socket.broadcast.volatile.emit('cursor', { id: socket.id, color, x, y });
```

Regla práctica: `volatile` para streams frecuentes donde lo viejo se vuelve irrelevante enseguida
(posición, cursores). `emit` normal para eventos puntuales que sí importan que lleguen (un destape,
un resultado).

## 4. Roles y reconexión (o: cooperativo en vez de 1v1)

En Pong, Snake, Cascada y Blastzone el código de roles es casi idéntico — la primera persona que se conecta es
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

**Buscaminas no usa este esquema.** No es 1 contra 1, es cooperativo entre cuantas personas se
conecten — no hay "player1" ni "esperando rival". Cualquiera que entra ya es parte de la partida
compartida, arranca de una:

```js
// games/buscaminas/server.js
players[socket.id] = { socket, color };
socket.emit('welcome', { color }); // le avisa su propio color, para su cursor
broadcastPlayerCount(); // le muestra a todos cuantos hay conectados ahora
```

Esto es una decisión de diseño, no una limitación técnica: si tu próximo juego es competitivo 1v1
(`Hundir la Flota`, `Turno`), usá el esquema de roles. Si es cooperativo (todos contra el tablero,
no entre sí), usá el esquema de Buscaminas.

## 5. El cliente: mandar inputs, dibujar lo que llega

Acá es donde Pong se diferencia de Snake y Cascada, y por una buena razón.

**Pong** interpola: guarda los últimos snapshots del servidor y dibuja ~80ms en el pasado,
mezclando entre dos snapshots (`games/pong/client.js`, función `getRenderState`). Hace falta porque
la pelota se mueve de forma continua a 60fps — sin interpolar, cualquier variación en la llegada de
paquetes por red se ve como tirones.

**Snake, Cascada y Buscaminas** no interpolan: dibujan directo el último estado que llegó
(`games/snake/duo.js`, `games/cascada/duo.js`, `games/buscaminas/coop.js`). No hace falta, porque
el movimiento ya es "a los saltos" por diseño — la víbora se mueve una celda entera cada 120ms, las
piezas de Cascada caen una fila cada 500ms, y en Buscaminas directamente no hay nada que se mueva
solo (ver la sección 6). Nada continuo que suavizar.

Regla práctica: si tu juego nuevo tiene movimiento continuo (algo tipo `Devora`), vas a necesitar
interpolar como Pong. Si es a grilla, por turnos o basado en clics (`Hundir la Flota`, `Turno`),
con dibujar el último estado alcanza.

## 6. Cuándo no hace falta loop: juegos por eventos

Pong, Snake, Cascada y Blastzone tienen algo que se mueve o avanza **solo** con el tiempo (una
pelota, la gravedad de una pieza, la mecha de una bomba) — por eso necesitan un `setInterval`
empujando el juego para adelante todo el tiempo, haya o no haya inputs nuevos.

Buscaminas no tiene nada de eso. Una celda no se destapa sola; el tablero está exactamente igual un
segundo después de que alguien lo miró, a menos que alguien haga clic. Por eso
`games/buscaminas/server.js` **no tiene ningún `setInterval`** — el servidor solo hace algo (y solo
manda `gameState` nuevo) como reacción directa a un evento del cliente:

```js
socket.on('reveal', (data) => {
  // ...validar...
  handleReveal(data.r, data.c);
  broadcastState(); // se manda SOLO porque paso esto, no cada X ms
});
```

Regla práctica: si en tu juego "no pasa nada" cuando nadie toca nada, no necesita loop — que sea en
tiempo real (varias personas viendo lo mismo en vivo) no significa que tenga que tickear. `Trivia`
y `Turno` probablemente van a ser así también: reaccionan a que alguien responda o juegue una
carta, no a que pase el tiempo.

## Lo que es específico de cada juego (no es parte del patrón)

- **Pong**: los ángulos de rebote, la aceleración de la pelota, la cuenta regresiva de saque.
- **Snake**: el crecimiento al comer, y la detección de choque usando `futureBody` — el cuerpo
  "tal como va a quedar" después de moverse (la cola se libera esa misma vuelta, salvo que la
  víbora esté por crecer).
- **Cascada**: la rotación de piezas (matriz 4x4 rotada, sin *wall-kick* — si al rotar no entra,
  simplemente no rota), y la mecánica de mandarle líneas de "basura" al rival cuando completás
  varias a la vez (`addGarbage` en `games/cascada/server.js`).
- **Buscaminas**: el destape en cascada de zonas vacías (flood-fill), que las minas recién se
  colocan después del primer clic de alguien (para que nunca pierdas en el primer intento), y que
  nunca se le manda al cliente dónde están las minas hasta que se revelan.
- **Blastzone**: la reacción en cadena entre bombas (si la explosión de una alcanza a otra, esa
  también explota, aunque le quedara mecha), el bloque destructible que esconde la salida en el
  modo solo, y el `MOVE_COOLDOWN_MS` que valida la velocidad de movimiento en el servidor.

## Cuándo este patrón NO aplica

Los modos solo de Snake, Cascada, Buscaminas y Blastzone (`solo.js` en cada carpeta) no siguen nada
de esto — no hay namespace, no hay servidor, no hay roles. Todo el estado del juego vive directo en
el navegador. Son la comparación perfecta para la regla de
[10 – WebSockets vs HTTP](10-websockets-vs-http.md): un juego que un jugador solo puede jugar sin
sincronizar nada con nadie no necesita servidor en absoluto.
