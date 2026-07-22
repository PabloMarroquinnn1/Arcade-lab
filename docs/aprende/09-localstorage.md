# 09 – localStorage

## Qué es

`localStorage` es un pequeño almacén de datos que el **navegador** guarda para tu sitio, en la
máquina de quien lo visita. Sobrevive a que cierres la pestaña o el navegador — solo se borra si el
usuario limpia los datos del sitio, o vos lo borrás por código.

Importante: es **por navegador y por origen** (ver [06 – Qué es CORS](06-que-es-cors.md) para qué
es un "origin"). Lo que guardás en `localhost:3000` no lo ve `otrodominio.com`, ni tu celular ve lo
que guardaste en tu PC.

## Cómo se usa

Solo guarda **texto** (strings). Para guardar objetos/arrays, hay que convertirlos con
`JSON.stringify` / `JSON.parse`:

```js
// Guardar
localStorage.setItem('nombreJugador', 'Pablo');

// Leer
const nombre = localStorage.getItem('nombreJugador'); // 'Pablo', o null si no existe

// Borrar una clave
localStorage.removeItem('nombreJugador');

// Guardar un objeto
localStorage.setItem('preferencias', JSON.stringify({ volumen: 0.5, controles: 'wasd' }));

// Leer un objeto
const preferencias = JSON.parse(localStorage.getItem('preferencias') || '{}');
```

## Para qué lo vamos a usar en este arcade

Todavía no lo usamos en el código (por ahora el hub no guarda nada), pero es la herramienta
correcta para cosas como:

- Recordar el nombre que elige un jugador, sin pedírselo cada vez.
- Guardar mejores puntajes **locales**, antes de tener una base de datos real (eso llega recién con
  `Mazmorra`, el juego 10).
- Recordar preferencias de la interfaz (ej. si prefiere controles de teclado o táctiles).

## localStorage vs base de datos

|                                 | localStorage                          | Base de datos (servidor) |
|---------------------------------|----------------------------------------|---------------------------|
| Dónde vive                      | En el navegador de cada jugador        | En tu servidor |
| Quién lo ve                     | Solo esa persona, en ese navegador     | Vos, desde cualquier dispositivo, compartido entre jugadores |
| Sirve para                      | Preferencias locales, cache            | Puntajes globales, cuentas, ranking compartido |
| Confiable para lógica de juego  | No — el jugador puede editarlo desde la consola | Sí, es tu servidor el que decide |

Por eso el leaderboard "de verdad" (comparar puntajes entre jugadores distintos) necesita servidor
+ base de datos tarde o temprano — localStorage no alcanza porque cada quien tiene el suyo,
aislado, y encima uno mismo podría editarlo para hacer trampa.
