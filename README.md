# Arcade Lab

Un arcade de minijuegos hecho para aprender desarrollo web construyendo cosas de verdad, no solo
leyendo teoría. Cada juego existe para enseñar un concepto concreto (una API, CORS, WebSockets,
Docker...), y todo lo que se va aprendiendo en el camino queda escrito en
[`docs/aprende`](docs/aprende) — explicado desde cero, para que cualquiera pueda entrar sin saber
programar y entender qué está pasando.

Es un proyecto abierto: si estás aprendiendo a programar, todo el código y los apuntes están
pensados para que los puedas leer, copiar y usar como te sirva.

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
- **`feature/`, `docs/`, `fix/`, `chore/`** → ramas cortas creadas desde `develop` para UNA cosa,
  con un prefijo que dice qué tipo de cambio es (funcionalidad, documentación, corrección,
  mantenimiento). Se mergean de vuelta a `develop` cuando funcionan, y se borran.

Detalle completo en [`docs/aprende/13-gitflow-en-este-repo.md`](docs/aprende/13-gitflow-en-este-repo.md).

## Qué juegos hay planeados

La lista completa (10 juegos, de menor a mayor dificultad, con el estado de cada uno) está en
[`hub/games.json`](hub/games.json) y se ve en vivo como tarjetas en la página principal del arcade
— no la repetimos acá para no tener dos lugares desactualizándose por separado.

## Stack

JavaScript "de toda la vida" en el frontend (sin librerías como React o Vue que agregan su propia
forma de escribir código) + Node.js con Express en el backend. Es a propósito: la idea de este
proyecto es entender cómo funcionan las cosas por debajo, y un framework de frontend tapa justo esa
parte. Más detalle en [`docs/aprende/03-que-son-las-librerias.md`](docs/aprende/03-que-son-las-librerias.md).
