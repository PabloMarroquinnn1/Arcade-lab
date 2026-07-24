# 04 – Qué es una API

API = *Application Programming Interface*. Es el "menú" de operaciones que un programa expone para
que otro programa lo use, sin que este último necesite saber cómo está hecho por dentro.

Analogía: en un restaurante, no entras a la cocina a cocinar — le pides al mesero (la API) algo del
menú, y el mesero te trae el resultado. No te importa cómo está montada la cocina.

## Tipos de API que vas a tocar en este proyecto

- **Web API del navegador**: `fetch`, `document`, `localStorage`, `WebSocket`, `Pointer Events`...
  son APIs que el navegador te da, no las escribes tú. Ejemplo de esta última, más abajo.
- **API HTTP propia**: el `server.js` de este repo expone `GET /api/juegos`. Es tu backend
  ofreciendo datos a tu frontend.
- **API en tiempo real**: Pong y Snake (modo 2 jugadores) tienen su propio "menú", pero de eventos
  de WebSocket en vez de URLs — `movePaddle`/`gameState` en Pong, `setDirection`/`gameState` en
  Snake. Ver [10](10-websockets-vs-http.md) y [14](14-logica-de-los-juegos-en-tiempo-real.md).

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

## Otro ejemplo de Web API: Pointer Events (mouse, dedo y lápiz, unificados)

Cuando el modo multijugador de `Dibuja y Adivina` necesite que alguien dibuje en el canvas, va a
usar la **Pointer Events API** — otra API que te da el navegador, como `fetch` o `localStorage`,
pero para saber "dónde tocaron y con qué".

Antes de que existiera, había que escuchar eventos separados para cada dispositivo: `mousedown` /
`mousemove` / `mouseup` para mouse, `touchstart` / `touchmove` / `touchend` para el dedo, y el
lápiz (S Pen de Samsung, Surface Pen, lápices tipo Wacom en tablets Lenovo) a veces se comportaba
como mouse y a veces como touch según el navegador — bugs raros y código repetido por dispositivo.

Pointer Events unifica los tres bajo un solo tipo de evento:

```js
canvas.addEventListener('pointerdown', (e) => {
  console.log(e.pointerType); // 'mouse' | 'touch' | 'pen'
  console.log(e.pressure);    // 0 a 1 — cuanto mas fuerte apretas (los lapices lo reportan, el mouse no)
});
canvas.addEventListener('pointermove', (e) => { /* seguir dibujando mientras se mueve */ });
canvas.addEventListener('pointerup', (e) => { /* soltar */ });
```

Con esos tres listeners nada más, el mismo código dibuja bien con mouse en la compu, con el dedo en
el celular, y con el lápiz en una tablet — sin escribir una rama de código distinta por cada
dispositivo. `e.pressure` es lo que, a futuro, podría usarse para que el trazo salga más grueso
cuanto más fuerte apretás con un lápiz de verdad.

Esto todavía no está en el código — llega con el modo multijugador de `Dibuja y Adivina`. Cuando
esté, esta sección va a apuntar al archivo real, como el resto de los ejemplos de esta carpeta.
