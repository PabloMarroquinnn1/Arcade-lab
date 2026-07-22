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

Así funciona el Pong original de este proyecto (antes de migrarlo aquí): el servidor corre el
juego a 60 "ticks" por segundo y **empuja** (`emit`) el estado a todos los jugadores conectados,
sin que ellos lo pidan.

## Socket.IO (la librería, no el protocolo puro)

Este proyecto usa `socket.io`, que por debajo usa WebSocket pero agrega comodidades: reconexión
automática si se corta la conexión, un plan B (usar peticiones normales en vez de WebSocket) si el
navegador o la red no lo permiten, y un sistema simple de eventos con nombre.

Servidor:

```js
const { Server } = require('socket.io');
const io = new Server(server);

io.on('connection', (socket) => {
  socket.on('movePaddle', (data) => { /* ... */ });
  io.emit('gameState', estadoDelJuego); // a todos
});
```

Cliente:

```js
const socket = io();
socket.emit('movePaddle', { direction: 'up' });
socket.on('gameState', (estado) => { /* dibujar */ });
```

## Regla práctica para decidir cuál usar en un juego nuevo

- ¿El juego es de un solo jugador contra la máquina, o el "estado" no necesita sincronizarse entre
  dos personas en tiempo real? → **HTTP normal** (o ni eso, todo en el navegador). Ejemplo: Snake
  solo.
- ¿Dos o más jugadores necesitan ver exactamente lo mismo al mismo tiempo (una pelota, un tablero
  compartido)? → **WebSocket**. Ejemplo: Pong, cualquier juego 1v1 en vivo.
