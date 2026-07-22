# 07 – Manejo de errores: try/catch

## El problema

Código que puede fallar (leer un archivo que no existe, convertir texto inválido a JSON, una
petición de red que se cae) puede **detener tu programa entero** si el error no se maneja.

```js
const datos = JSON.parse('esto no es JSON'); // Error: Unexpected token
console.log('esta línea nunca se ejecuta');
```

## try/catch

`try` envuelve el código que puede fallar. Si algo dentro de `try` lanza un error, la ejecución
salta directo a `catch`, sin detener el resto del programa:

```js
try {
  const datos = JSON.parse('esto no es JSON');
  console.log('esta línea tampoco se ejecuta');
} catch (error) {
  console.log('Algo falló:', error.message);
}

console.log('pero esta sí, el programa sigue vivo');
```

`error` (el nombre es cualquiera, podrías llamarlo `e`) es un objeto con información sobre qué
salió mal — `error.message` es el texto legible.

## Dónde lo vas a usar en este proyecto

Con `await` (fetch, lectura de archivos async) es el patrón estándar — ver
[08 – Promesas y async/await](08-promesas-y-async-await.md). Ejemplo real de `hub/app.js`:

```js
async function cargarJuegos() {
  try {
    const respuesta = await fetch('/api/juegos');
    if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);
    const juegos = await respuesta.json();
    // ...
  } catch (error) {
    grid.innerHTML = `<p class="aviso">No se pudo cargar la lista de juegos: ${error.message}</p>`;
  }
}
```

Si el servidor está caído, la red falla, o la respuesta no es JSON válido, el `catch` lo atrapa y
muestra un mensaje en vez de romper toda la página en blanco.

## `throw`: lanzar tus propios errores

`throw new Error('mensaje')` crea y lanza un error a propósito. Es cómo decís "esto no debería
pasar, andá al catch". En el ejemplo de arriba, `fetch` no considera un 404 o 500 como un error de
red — por eso hay que revisar `respuesta.ok` y lanzar el error nosotros mismos si el servidor
respondió mal.

## Qué NO hacer

```js
try {
  hacerAlgoRiesgoso();
} catch (error) {
  // vacío — el error desaparece sin dejar rastro
}
```

Un `catch` vacío esconde errores reales y hace que depurar sea muchísimo más difícil. Como mínimo,
logueá el error (`console.error(error)`) aunque no sepas todavía qué hacer con él.
