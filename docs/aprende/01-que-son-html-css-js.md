# 01 – Qué son HTML, CSS y JS

Estas son las tres piezas con las que está hecho literalmente cualquier página o app web, incluido
este arcade. Cada una hace un trabajo distinto y no se reemplazan entre sí.

## HTML – la estructura

HTML (HyperText Markup Language) define **qué hay** en la página: un título, un párrafo, una
lista, un botón. Se escribe con etiquetas (`tags`).

Ejemplo real, de `hub/index.html`:

```html
<h1>Arcade Lab</h1>
<p>Un arcade casero para aprender desarrollo web jugando.</p>
<div id="grid-juegos" class="grid-juegos"></div>
```

- `<h1>` = título grande.
- `<p>` = párrafo.
- `<div>` = una caja genérica sin significado propio, solo para agrupar (aquí, la que va a
  contener las tarjetas de juegos).
- `id="grid-juegos"` — identificador único, para que CSS/JS puedan encontrar exactamente este
  elemento.
- `class="grid-juegos"` — una etiqueta que puede repetirse en varios elementos, usada por CSS para
  darles el mismo estilo.

Sin CSS ni JS, un HTML se ve como texto plano de arriba a abajo, sin colores ni interactividad.

## CSS – la apariencia

CSS (Cascading Style Sheets) define **cómo se ve** lo que HTML describe: colores, tamaños,
posición, espaciado.

Ejemplo real, de `hub/style.css`:

```css
.grid-juegos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}
```

Esto le dice al navegador: "el elemento con clase `grid-juegos` (nuestro `<div>` de arriba)
organiza a sus hijos en una grilla, con columnas de al menos 240px, y deja 1rem de espacio entre
ellos". Es CSS el que convierte una lista de tarjetas en una grilla ordenada en vez de texto
apilado.

## JavaScript – el comportamiento

JS es el único de los tres que **hace cosas**: reacciona a clics, pide datos a un servidor, cambia
el HTML después de que la página ya cargó.

Ejemplo real, de `hub/app.js`:

```js
async function cargarJuegos() {
  const grid = document.getElementById('grid-juegos');
  const respuesta = await fetch('/api/juegos');
  const juegos = await respuesta.json();
  juegos.forEach((juego) => grid.appendChild(crearTarjeta(juego)));
}
```

Esto agarra el `<div id="grid-juegos">` que HTML definió, le pide la lista de juegos al servidor,
y **construye HTML nuevo dinámicamente** (una tarjeta por juego) sin que tú hayas escrito esas 10
tarjetas a mano en `index.html`.

## Cómo se conectan los tres

```html
<link rel="stylesheet" href="style.css">  <!-- HTML carga el CSS -->
<script src="app.js"></script>             <!-- HTML carga el JS -->
```

El navegador lee el HTML de arriba a abajo, aplica el CSS que encuentre, y ejecuta el JS. Por eso
en este repo cada juego va a tener su propio HTML/CSS/JS: son piezas separadas que el navegador
junta al mostrar la página.
