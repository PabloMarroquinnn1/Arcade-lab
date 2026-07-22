async function cargarJuegos() {
  const lista = document.getElementById('lista-juegos');

  try {
    const respuesta = await fetch('/api/juegos');
    if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);
    const juegos = await respuesta.json();

    if (juegos.length === 0) {
      lista.innerHTML = '<li>Todavía no hay juegos publicados. El primero viene pronto.</li>';
      return;
    }

    lista.innerHTML = juegos
      .map((juego) => `<li><a href="${juego.ruta}">${juego.nombre}</a> — ${juego.descripcion}</li>`)
      .join('');
  } catch (error) {
    lista.innerHTML = `<li>No se pudo cargar la lista de juegos: ${error.message}</li>`;
  }
}

cargarJuegos();
