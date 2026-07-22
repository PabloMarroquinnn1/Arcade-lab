# 02 – Qué es una API

API = *Application Programming Interface*. Es el "menú" de operaciones que un programa expone para
que otro programa lo use, sin que este último necesite saber cómo está hecho por dentro.

Analogía: en un restaurante, no entras a la cocina a cocinar — le pides al mesero (la API) algo del
menú, y el mesero te trae el resultado. No te importa cómo está montada la cocina.

## Tipos de API que vas a tocar en este proyecto

- **Web API del navegador**: `fetch`, `document`, `localStorage`, `WebSocket`... son APIs que el
  navegador te da, no las escribes tú.
- **API HTTP propia**: el `server.js` de este repo expone `GET /api/juegos`. Es tu backend
  ofreciendo datos a tu frontend.
- **API en tiempo real**: cuando migremos Pong, el "menú" de operaciones no será HTTP sino eventos
  de WebSocket (`movePaddle`, `gameState`...) — ver [06](06-websockets-vs-http.md).

## Ejemplo real de este repo

Abre `server.js` y busca:

```js
app.get('/api/juegos', (req, res) => {
  // ...
  res.json(JSON.parse(data));
});
```

Eso es una API: un punto de entrada (`/api/juegos`) que cualquier cliente (tu `hub/app.js`, `curl`,
Postman, otro sitio) puede llamar para obtener datos, sin saber que por dentro estás leyendo un
archivo JSON del disco.

Pruébalo corriendo el server y visitando `http://localhost:3000/api/juegos` en el navegador.
