# 02 – El JavaScript que necesitas

No hace falta saber todo JS para este proyecto. Esto es lo mínimo que vas a usar una y otra vez.

## Declarar variables

```js
let vidas = 3;          // cambia de valor
const nombre = 'Pablo'; // no cambia (la referencia; si es un objeto, sus propiedades sí pueden cambiar)
```

Existe una tercera forma, `var`, que es la más vieja de las tres — evítala. Tiene reglas confusas
sobre "hasta dónde" se puede usar una variable dentro del código (a eso se le llama el *alcance* de
la variable), y `let`/`const` resuelven ese problema. Regla simple: usa `let` si el valor va a
cambiar, `const` si no.

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

Un **objeto** agrupa datos relacionados bajo nombres (`nombre`, `puntos`). Un **array** es una
lista ordenada de valores.

```js
const jugador = { nombre: 'p1', puntos: 0 };
const juegos = ['pong', 'snake'];
```

Dos atajos que vas a ver seguido en el código de este repo:

**Destructuring** — sacar valores de un objeto o array directo a variables sueltas, sin escribir
`jugador.nombre` cada vez:

```js
const { nombre, puntos } = jugador; // nombre = 'p1', puntos = 0
const [primero] = juegos;           // primero = 'pong'
```

**Spread (`...`)** — copiar todas las propiedades de un objeto (o valores de un array) dentro de
otro nuevo, pudiendo sobreescribir algunas:

```js
const jugador2 = { ...jugador, puntos: 5 }; // copia jugador, pero con puntos en 5
```

`jugador2` es un objeto **nuevo** — `jugador` original no cambia. Esto importa porque evita bugs
donde modificás un objeto sin querer en un lugar y se rompe algo en otro lugar que lo estaba usando.

## Template literals

```js
const mensaje = `${nombre} tiene ${puntos} puntos`;
```

Mejor que concatenar con `+`.

## Módulos: dividir el código en archivos

Un **módulo** es, en la práctica, un archivo de JS que le presta código (funciones, variables) a
otro archivo, en vez de tener todo el proyecto en un solo archivo enorme. Partir el código así hace
que cada archivo tenga una responsabilidad clara y sea más fácil de encontrar algo cuando lo
necesitás.

Node.js (el motor que corre nuestro `server.js`, ver
[03 – Qué son las librerías](03-que-son-las-librerias.md)) usa para esto la palabra `require`, para
traer código que vive en otro lado:

```js
const express = require('express');
```

Esa línea dice: "andá a buscar el código que exporta la librería `express`, y guardámelo en la
variable `express`". Es la misma idea de "importar" que hay en casi todos los lenguajes, solo que
con otro nombre.

Si en algún momento ves `import` y `export` en vez de `require` — es otra forma de hacer
exactamente lo mismo (se llama *ES Modules*, y es la que entienden los navegadores de forma
nativa). Pero no es la que usamos acá: Node, sin configurar nada extra, entiende `require` por
defecto, así que es la que vas a encontrar en todo `server.js`.

## El event loop, en una frase

JavaScript ejecuta una cosa a la vez, pero no se queda "esperando" tareas lentas (leer un archivo,
pedir datos por red): las delega y sigue con lo demás, y vuelve a tu código cuando esa tarea
termina. Eso es exactamente lo que hace posible `async/await` (ver
[08](08-promesas-y-async-await.md)) y por lo que un servidor Node puede atender a varios jugadores
de Pong "a la vez" con un solo proceso, sin necesitar uno separado por cada jugador.
