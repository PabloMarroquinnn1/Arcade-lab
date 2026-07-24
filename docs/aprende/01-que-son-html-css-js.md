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
  elemento. Un `id` no se puede repetir en la misma página.
- `class="grid-juegos"` — una etiqueta que puede repetirse en varios elementos, usada por CSS para
  darles el mismo estilo. Un elemento puede tener varias clases a la vez (`class="badge p1"`).

Un dato que te va a servir para leer cualquier juego de este repo: `id`, `class`, `href`, `src` son
**atributos** — información extra que le agregás a una etiqueta, siempre dentro del tag de
apertura (`<div id="..." class="...">`). Cada tipo de etiqueta acepta atributos distintos.

Sin CSS ni JS, un HTML se ve como texto plano de arriba a abajo, sin colores ni interactividad.

### Etiquetas semánticas: decir para qué es cada parte, no solo dónde va

Además de `<div>` (que no significa nada por sí sola), HTML tiene etiquetas que describen **qué
rol** cumple esa parte de la página. Las vas a ver en el `<body>` de *todos* los juegos de este
arcade:

```html
<header id="hud">...</header>   <!-- la franja de arriba: marcador, estado, botones -->
<main id="stage">...</main>     <!-- el contenido principal: el tablero o canvas del juego -->
<footer id="controls">...</footer> <!-- la franja de abajo: instrucciones de controles -->
```

Funcionalmente `<header>` y `<div>` hacen casi lo mismo (agrupar). La diferencia es que
`<header>`/`<main>`/`<footer>` le dicen a quien lea el código (vos en dos meses, un lector de
pantalla para alguien con discapacidad visual, un buscador) **qué es** cada bloque, no solo que es
"una caja más". Usalas cuando el bloque tiene un rol claro; usá `<div>` cuando es solo una caja
genérica para agrupar o para que CSS le aplique un estilo.

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

### Selectores: a quién le aplica cada regla

`.grid-juegos { ... }` es un **selector** — la parte antes de las llaves, que dice a qué
elementos se les aplica lo que sigue. Los tres tipos que vas a ver todo el tiempo en este repo:

```css
#hud { ... }     /* por id: un unico elemento, el que tenga id="hud" */
.badge { ... }   /* por clase: TODOS los elementos con class="badge" */
canvas { ... }   /* por etiqueta: TODOS los <canvas> de la pagina */
```

### Variables de CSS: definir un valor una vez, usarlo en todos lados

Abrí cualquier `style.css` de este repo y vas a ver algo así arriba de todo:

```css
:root {
  --bg: #0a0a14;
  --neon-green: #00ff88;
}
```

Eso declara dos **variables** (técnicamente se llaman *custom properties*): `--bg` y
`--neon-green`. Después, en cualquier parte del mismo archivo, se usan con `var()`:

```css
body { background: var(--bg); }
#logo { color: var(--neon-green); }
```

La ventaja: si mañana querés cambiar el verde neón de todo el juego, lo cambiás en **un solo
lugar** (la variable), no en cada regla que usaba ese color a mano.

### Flexbox: acomodar en una fila (o columna)

Casi todos los `#hud` (la franja de arriba) de este repo usan Flexbox:

```css
#hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

`display: flex` le dice al elemento: "acomodá a tus hijos en una fila (o columna, con
`flex-direction: column`), uno al lado del otro". `align-items: center` los centra verticalmente;
`justify-content: space-between` empuja el primero a la izquierda y el último a la derecha,
repartiendo el espacio libre entre los del medio. Es la herramienta correcta cuando tenés **una
sola fila o columna** de cosas para acomodar.

### Grid: acomodar en filas Y columnas a la vez

Cuando necesitás una **tabla** de elementos (varias filas, varias columnas), Flexbox se queda
corto y se usa `display: grid` — el mismo que vimos arriba en `.grid-juegos`, y también el que arma
el tablero de Buscaminas:

```css
.board {
  display: grid;
  gap: 2px;
}
```

```js
// games/buscaminas/solo.js
boardEl.style.gridTemplateColumns = `repeat(${COLS}, 28px)`;
```

Ojo con algo que puede confundir: en este repo la palabra **"grid" se usa para dos cosas
relacionadas pero distintas**. Acá, `display: grid`, es una técnica de CSS para *acomodar
elementos visualmente* en filas y columnas. Pero en el código de Snake, Cascada, Buscaminas y
Blastzone también hay un `grid` que es una **matriz de JavaScript** (un array de arrays,
`board[fila][columna]`) que representa el tablero del juego — de qué está hecha cada celda (una
mina, un bloque, una pared). Son cosas separadas que casualmente comparten nombre: una es CSS
puro (solo dibuja), la otra es la lógica del juego en JS (decide qué hay en cada celda). Buscaminas
usa las dos juntas: JS calcula el contenido de cada celda, CSS Grid las ubica en pantalla.

### Media queries: estilos distintos según el tamaño de pantalla

```css
@media (max-width: 480px) {
  .badge, .score-tag { font-size: 0.45rem; padding: 6px 10px; }
}
```

Un `@media` es una regla condicional: "aplicá lo de adentro **solo si** se cumple esto" — en este
caso, solo si la pantalla mide 480px o menos de ancho (un celular, básicamente). Así es como el
mismo CSS achica el texto en pantallas chicas sin necesitar una página aparte para mobile.

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
