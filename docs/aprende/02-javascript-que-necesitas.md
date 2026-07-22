# 02 – El JavaScript que necesitas

No hace falta saber todo JS para este proyecto. Esto es lo mínimo que vas a usar una y otra vez.

## Declarar variables

```js
let vidas = 3;          // cambia de valor
const nombre = 'Pablo'; // no cambia (la referencia; si es un objeto, sus propiedades sí pueden cambiar)
```

Evita `var` — es la forma vieja, con reglas de alcance confusas. Usa `let` si va a cambiar, `const`
si no.

## Funciones

Una función es un bloque de código con nombre que puede recibir "ingredientes" (parámetros) y
devolver un resultado.

```js
function sumar(a, b) {
  return a + b;
}

sumar(2, 3); // 5

// Arrow function: lo mismo, más corto, y sin su propio `this`
const sumar2 = (a, b) => a + b;
```

- `a` y `b` son los **parámetros** (los nombres que usa la función por dentro).
- `2` y `3` son los **argumentos** (los valores reales que le pasás al llamarla).
- `return` es lo que la función "entrega" de vuelta. Sin `return`, la función devuelve
  `undefined`.

### Funciones que reciben otras funciones (callbacks)

Esto es central en este proyecto. Una función puede recibir otra función como argumento, para que
la ejecute en el momento justo — no ahora, sino cuando corresponda:

```js
boton.addEventListener('click', () => {
  console.log('clic');
});
```

`() => { console.log('clic'); }` es una función anónima que le pasamos a `addEventListener`. No se
ejecuta al escribir esta línea — se ejecuta **cuando** ocurre el clic. `addEventListener` la guarda
y la llama en ese momento; a esto se le llama **callback**.

Lo mismo pasa en el backend, en `server.js`:

```js
app.get('/api/juegos', (req, res) => {
  // esta función se ejecuta cada vez que alguien pide GET /api/juegos, no antes
});
```

### Funciones que arman otras cosas

En `hub/app.js`, `crearTarjeta(juego)` es una función que recibe un objeto `juego` y devuelve un
elemento HTML ya armado. `cargarJuegos()` la llama una vez por cada juego de la lista:

```js
juegos.forEach((juego) => grid.appendChild(crearTarjeta(juego)));
```

Es un patrón muy común: una función chica que hace UNA cosa bien (crear una tarjeta), reutilizada
tantas veces como haga falta, en vez de repetir el mismo bloque de código 10 veces.

## Objetos y arrays

```js
const jugador = { nombre: 'p1', puntos: 0 };
const juegos = ['pong', 'snake'];

// Destructuring: sacar valores directo
const { nombre, puntos } = jugador;
const [primero] = juegos;

// Spread: copiar/combinar
const jugador2 = { ...jugador, puntos: 5 };
```

## Template literals

```js
const mensaje = `${nombre} tiene ${puntos} puntos`;
```

Mejor que concatenar con `+`.

## Módulos: `require` vs `import`

En este repo el backend (`server.js`) usa Node.js con `require` (CommonJS):

```js
const express = require('express');
```

Si en algún momento usas `import`/`export` en el navegador (ES Modules), necesitas
`<script type="module">`. En Node puro, sin configurar nada extra, `require` es lo que funciona
por defecto — por eso lo usamos en `server.js`.

## El event loop, en una frase

JavaScript ejecuta una cosa a la vez, pero no se queda "esperando" tareas lentas (leer un archivo,
pedir datos por red): las delega y sigue con lo demás, y vuelve a tu código cuando esa tarea
termina. Eso es exactamente lo que hace posible `async/await` (ver
[08](08-promesas-y-async-await.md)) y por lo que un servidor Node puede atender a varios jugadores
de Pong "a la vez" sin ser multi-hilo.
