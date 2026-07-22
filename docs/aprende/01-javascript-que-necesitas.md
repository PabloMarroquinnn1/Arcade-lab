# 01 – El JavaScript que necesitas

No hace falta saber todo JS para este proyecto. Esto es lo mínimo que vas a usar una y otra vez.

## Declarar variables

```js
let vidas = 3;          // cambia de valor
const nombre = 'Pablo'; // no cambia (la referencia; si es un objeto, sus propiedades sí pueden cambiar)
```

Evita `var` — es la forma vieja, con reglas de alcance confusas. Usa `let` si va a cambiar, `const`
si no.

## Funciones

```js
function sumar(a, b) {
  return a + b;
}

// Arrow function: lo mismo, más corto, y sin su propio `this`
const sumar2 = (a, b) => a + b;
```

En este proyecto vas a ver arrow functions todo el tiempo, sobre todo como callbacks:

```js
boton.addEventListener('click', () => {
  console.log('clic');
});
```

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
[05](05-promesas-y-async-await.md)) y por lo que un servidor Node puede atender a varios jugadores
de Pong "a la vez" sin ser multi-hilo.
