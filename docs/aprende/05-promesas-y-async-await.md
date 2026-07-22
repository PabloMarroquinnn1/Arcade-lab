# 05 – Promesas y async/await

## El problema que resuelven

JS no se detiene a esperar tareas lentas (pedir datos por red, leer un archivo). Antes eso se
resolvía con **callbacks anidados** que se vuelven ilegibles ("callback hell"):

```js
leerArchivo('a.json', (err, a) => {
  leerArchivo('b.json', (err, b) => {
    leerArchivo('c.json', (err, c) => {
      // ...
    });
  });
});
```

## Promesas

Una **Promise** representa "un valor que vas a tener, eventualmente" (o un error). `fetch` ya
devuelve una:

```js
fetch('/api/juegos')
  .then((respuesta) => respuesta.json())
  .then((juegos) => console.log(juegos))
  .catch((error) => console.error(error));
```

## async/await: lo mismo, pero se lee como código normal

```js
async function cargarJuegos() {
  try {
    const respuesta = await fetch('/api/juegos');
    const juegos = await respuesta.json();
    console.log(juegos);
  } catch (error) {
    console.error(error);
  }
}
```

Reglas simples:

- `await` solo funciona dentro de una función marcada `async`.
- `await` "pausa" esa función (no el programa entero) hasta que la promesa se resuelve.
- Los errores de una promesa rechazada se capturan con `try/catch` alrededor del `await`.

## Ejemplo real de este repo

`hub/app.js` usa exactamente este patrón para pedir la lista de juegos al servidor:

```js
async function cargarJuegos() {
  const respuesta = await fetch('/api/juegos');
  if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);
  const juegos = await respuesta.json();
  // ...
}
```

Nota el `if (!respuesta.ok)`: `fetch` **no** rechaza la promesa en errores HTTP (404, 500...), solo
en errores de red. Por eso hay que chequear `.ok` a mano y lanzar el error tú mismo si hace falta.
