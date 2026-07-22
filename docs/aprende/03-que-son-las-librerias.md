# 03 – Qué son las librerías (y dónde las usamos)

Una librería es código que **alguien más ya escribió y probó**, que instalas y usas en vez de
reescribirlo vos. Te ahorra resolver problemas ya resueltos (servir archivos por HTTP, manejar
WebSockets, etc.).

## Cómo entra una librería a este proyecto

En `package.json`:

```json
"dependencies": {
  "express": "^4.21.2"
}
```

Eso declara que este proyecto **depende** de la librería `express`, versión 4.21.x o compatible.
Cuando corres `npm install`, npm descarga esa librería (y sus propias dependencias) a la carpeta
`node_modules/` — por eso `node_modules/` está en `.gitignore`: no se sube al repo, se regenera con
`npm install` en cualquier máquina.

En `server.js` la usamos así:

```js
const express = require('express');
const app = express();
```

`require('express')` carga la librería. `express()` crea una aplicación web lista para recibir
peticiones — sin escribir vos mismo un servidor HTTP desde cero (entender qué pidió el navegador,
manejar cada conexión, etc.), que es un problema grande y ya resuelto.

## npm, en corto

npm (Node Package Manager) es el catálogo + herramienta para instalar librerías de Node. Comandos
que vas a usar seguido:

```bash
npm install <libreria>   # instala y la agrega a package.json
npm install               # instala TODO lo que ya está en package.json (ej. al clonar el repo)
npm start                 # corre el script "start" definido en package.json
```

## Cuándo vas a instalar librerías nuevas en este proyecto

- Cuando migremos Pong: `socket.io`, para WebSockets con reconexión automática y sistema de
  eventos, en vez de escribir el protocolo de WebSocket a mano.
- Más adelante, si agregamos CORS entre orígenes distintos: la librería `cors` (ver
  [06 – Qué es CORS](06-que-es-cors.md)).
- Cuando lleguemos a `Mazmorra` con base de datos: algo como `better-sqlite3` o un cliente de
  Postgres.

## Escribir tu propio código vs usar una librería

Regla práctica: si el problema es genérico y lo resolvió mucha gente antes que vos (servir
archivos, parsear JSON, manejar reconexiones de socket), usa una librería. Si el problema es
específico de tu juego (la física de la pelota de Pong, las reglas de Turno), eso lo escribís vos —
ninguna librería sabe cómo querés que funcione tu juego.
