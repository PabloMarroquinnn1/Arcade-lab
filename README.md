# Arcade Lab

Arcade de minijuegos para aprender desarrollo web de verdad: JavaScript, APIs, REST, CORS,
async/await, WebSockets y Docker — construyendo juegos jugables, corriendo en un servidor casero
propio (Ubuntu Server 24, HP vieja, expuesto con Cloudflare Tunnel).

No es solo una colección de juegos: cada uno existe para enseñar un concepto concreto, y los
apuntes están en [`docs/aprende`](docs/aprende).

## Estructura del repo

```
arcade-lab/
├── hub/              # Página principal del arcade (estático: HTML/CSS/JS)
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── games.json    # Lista de juegos publicados (la sirve /api/juegos)
├── games/             # Cada juego en su propia carpeta (vacío por ahora)
├── docs/aprende/      # Apuntes: qué es una API, REST, CORS, async/await, WebSockets, Docker...
├── server.js          # Express: sirve el hub, los juegos y la API
├── Dockerfile
└── docker-compose.yml
```

## Cómo correrlo

Local, sin Docker:

```bash
npm install
npm start
# abre http://localhost:3000
```

Con Docker (así corre en el servidor real):

```bash
docker compose up --build -d
```

## Aprende

Empieza por [`docs/aprende/00-como-usar-esta-carpeta.md`](docs/aprende/00-como-usar-esta-carpeta.md).
Cada archivo enseña un concepto y, cuando aplica, apunta a código real de este mismo repo que lo usa.

## Flujo de trabajo (gitflow simplificado)

- **`main`** → siempre lo que corre en el servidor. Solo recibe merges desde `develop`.
- **`develop`** → rama de integración; ahí se juntan las features antes de pasar a producción.
- **`feature/lo-que-sea`** → rama corta creada desde `develop` para UNA cosa (un juego, una sección
  de docs, un fix). Se mergea de vuelta a `develop` cuando funciona, y se borra.

Detalle completo en [`docs/aprende/09-gitflow-en-este-repo.md`](docs/aprende/09-gitflow-en-este-repo.md).

## Roadmap

- [ ] Migrar Pong (WebSocket) como primer juego en tiempo real
- [ ] Un juego estático (ej. Snake) como segundo ejemplo, sin servidor
- [ ] Deploy en el servidor casero con Cloudflare Tunnel

## Stack

Vanilla JS + Node.js/Express (+ Socket.IO cuando llegue el primer juego en tiempo real). Sin
frameworks de frontend (React/Vue/Angular) a propósito: el objetivo es aprender los fundamentos,
no la API de un framework.
