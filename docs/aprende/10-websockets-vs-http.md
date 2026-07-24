# 10 – WebSockets vs HTTP

## HTTP: pregunta-respuesta

Con HTTP (lo que usa `fetch`, o cargar una página), el cliente **siempre inicia**: pide algo, el
servidor responde, y la conexión termina (o se reutiliza, pero el patrón es petición →
respuesta). El servidor no puede "avisarte" nada si tú no le preguntaste primero.

Sirve perfecto para: cargar la lista de juegos, guardar un puntaje, login... cosas puntuales.

**No** sirve bien para: un juego donde la posición de la pelota cambia 60 veces por segundo y
**ambos** jugadores necesitan enterarse al instante sin estar preguntando "¿ya cambió? ¿ya
cambió? ¿ya cambió?" (eso sería *polling*, y es lento y desperdicia recursos).

## WebSocket: conexión abierta en los dos sentidos

Un WebSocket abre **una conexión persistente**: una vez conectado, tanto el cliente como el
servidor pueden enviar mensajes en cualquier momento, sin que el otro lo haya pedido.

Así funciona Pong en este arcade (`games/pong/server.js`): el servidor corre el juego a 60 "ticks"
por segundo y **empuja** (`emit`) el estado a todos los jugadores conectados, sin que ellos lo
pidan.

## Socket.IO (la librería, no el protocolo puro)

Este proyecto usa `socket.io`, que por debajo usa WebSocket pero agrega comodidades: reconexión
automática si se corta la conexión, un plan B (usar peticiones normales en vez de WebSocket) si el
navegador o la red no lo permiten, y un sistema simple de eventos con nombre.

### Qué es un namespace

Antes del código, una palabra que vas a ver todo el tiempo de acá en adelante: **namespace**
("espacio de nombres"). La idea, en general, fuera de Socket.IO: cuando varias cosas podrían
llamarse igual y confundirse entre sí, las agrupás bajo un espacio separado para que no choquen —
como tener una carpeta `pong/` y una carpeta `snake/` en vez de tirar todos los archivos sueltos
mezclados en un mismo lugar.

En Socket.IO puntualmente, un namespace es un **canal de comunicación aparte, dentro del mismo
servidor y la misma conexión** — no es un servidor nuevo ni un puerto distinto, es una separación
lógica. Cada juego de este arcade tiene el suyo (`/pong`, `/snake`, `/cascada`...), así un evento
`gameState` de Pong nunca se mezcla con uno de Snake, aunque los dos viajen por la misma conexión
de red hacia el mismo servidor.

Servidor — este es el código real de `games/pong/server.js`, simplificado:

```js
const { Server } = require('socket.io');
const io = new Server(httpServer);
const pong = io.of('/pong'); // namespace propio, ver 14

pong.on('connection', (socket) => {
  socket.on('movePaddle', (data) => { /* ... */ });
  pong.volatile.emit('gameState', estadoDelJuego); // a todos los conectados a /pong
});
```

Cliente — de `games/pong/client.js`:

```js
const socket = io('/pong', { transports: ['websocket'] });
socket.emit('movePaddle', { direction: 'up' });
socket.on('gameState', (estado) => { /* dibujar */ });
```

El `/pong` al conectar es el mismo namespace del lado servidor — así el cliente le habla solo a
ese juego, y no se mezcla con los eventos de Snake, que usa `/snake`.

## Regla práctica para decidir cuál usar en un juego nuevo

- ¿El juego es de un solo jugador, o el "estado" no necesita sincronizarse entre dos personas en
  tiempo real? → **ni HTTP ni WebSocket, todo en el navegador**. Ejemplo real: Snake modo solo
  (`games/snake/solo.js`) — ni siquiera le habla al servidor mientras juega.
- ¿Dos o más jugadores necesitan ver exactamente lo mismo al mismo tiempo (una pelota, un tablero
  compartido)? → **WebSocket**. Ejemplo real: Pong, y Snake modo 2 jugadores
  (`games/snake/duo.js`) — el mismo juego, en dos modos distintos, resolviendo esta pregunta de
  forma distinta.

El patrón completo de cómo están armados Pong y Snake por dentro está en
[14 – La lógica de los juegos en tiempo real](14-logica-de-los-juegos-en-tiempo-real.md).
