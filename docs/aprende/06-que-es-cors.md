# 06 – Qué es CORS (y por qué da tanto dolor de cabeza)

CORS = *Cross-Origin Resource Sharing*. Es una regla de seguridad que aplican **los navegadores**
(no los servidores) para evitar que una página web le "robe" datos a otra sin permiso.

## Qué es un "origin"

Un origin es la combinación exacta de **protocolo + dominio + puerto**:

```
http://localhost:3000        → origin A
http://localhost:5500        → origin B (puerto distinto = origin distinto)
https://arcade.tudominio.com → origin C
```

## Cuándo aparece el problema

Si tu `hub/app.js` (servido desde `http://localhost:3000`) hace
`fetch('http://localhost:3000/api/juegos')`, **no hay problema** — mismo origin, el navegador no
bloquea nada. Esto es lo que pasa hoy en este repo, porque todo (hub + API) lo sirve el mismo
`server.js` en el mismo puerto.

El problema aparece si algún día separas cosas — por ejemplo, si desarrollas el hub con Live Server
en `http://localhost:5500` pero el backend sigue en `http://localhost:3000`. Ahí el navegador
bloquea la respuesta con un error tipo:

```
Access to fetch at 'http://localhost:3000/api/juegos' from origin 'http://localhost:5500'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

Importante: **la petición sí llega al servidor** (no es un firewall), pero el navegador descarta
la respuesta antes de dártela, porque el servidor no dijo explícitamente "confío en ese origin".

## Cómo se arregla (del lado del servidor)

El servidor tiene que responder con una cabecera diciendo qué origins confía:

```js
const cors = require('cors');
app.use(cors({ origin: 'http://localhost:5500' }));
```

O, para desarrollo rápido, permitir cualquier origin (nunca hagas esto en un endpoint sensible en
producción sin pensarlo):

```js
app.use(cors());
```

Este repo hoy **no necesita `cors`** porque hub y API comparten origin. El día que muevas el hub a
un dominio y el backend a otro (o corras el hub desde un CDN aparte), esa es la señal de que sí
toca instalarlo.
