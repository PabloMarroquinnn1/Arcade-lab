function crearTarjeta(juego) {
  const jugable = juego.estado === 'jugable';

  const tags = juego.tecnologias
    .map((tag) => `<span class="tag">${tag}</span>`)
    .join('');

  const accion = jugable
    ? `<a class="btn-jugar" href="${juego.ruta}">Jugar</a>`
    : `<span class="btn-jugar deshabilitado">Próximamente</span>`;

  const articulo = document.createElement('article');
  articulo.className = 'card' + (jugable ? ' jugable' : '');
  articulo.innerHTML = `
    <div class="card-header">
      <h3>${juego.nombre}</h3>
      <span class="badge-dificultad" title="Dificultad ${juego.dificultad}/10">${juego.dificultad}/10</span>
    </div>
    <p class="card-desc">${juego.descripcion}</p>
    <div class="card-tags">${tags}</div>
    ${accion}
  `;
  return articulo;
}

async function cargarJuegos() {
  const grid = document.getElementById('grid-juegos');

  try {
    const respuesta = await fetch('/api/juegos');
    if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);
    const juegos = await respuesta.json();

    if (juegos.length === 0) {
      grid.innerHTML = '<p class="aviso">Todavía no hay juegos publicados. El primero viene pronto.</p>';
      return;
    }

    grid.innerHTML = '';
    juegos
      .sort((a, b) => a.dificultad - b.dificultad)
      .forEach((juego) => grid.appendChild(crearTarjeta(juego)));
  } catch (error) {
    grid.innerHTML = `<p class="aviso">No se pudo cargar la lista de juegos: ${error.message}</p>`;
  }
}

cargarJuegos();
