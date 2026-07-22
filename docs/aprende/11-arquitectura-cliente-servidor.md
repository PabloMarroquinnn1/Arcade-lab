# 11 – Arquitectura cliente-servidor de este arcade

## Las dos partes

- **Cliente**: lo que corre en el navegador de quien juega — HTML, CSS, JS (`hub/`, y el frontend
  de cada juego en `games/<nombre>/`). No es de confiar: cualquiera puede abrir la consola y mandar
  lo que quiera.
- **Servidor**: el único `server.js`, corriendo en Node dentro de un contenedor Docker en tu HP con
  Ubuntu Server. Es la autoridad — decide qué es verdad (quién ganó, dónde está la pelota).

Esto ya lo hiciste bien en el Pong original: el servidor calcula la física de la pelota y las
paletas; el cliente solo manda "quiero moverme para arriba" y dibuja lo que el servidor le dice. Si
el cliente pudiera decidir "gané", cualquiera podría hacer trampa editando el JS del navegador.

## Cómo se sirve todo en este repo

Un solo proceso Node (`server.js`) hace tres cosas:

1. Sirve `hub/` como archivos estáticos en `/` (la página principal del arcade).
2. Sirve cada `games/<nombre>/` como archivos estáticos en `/games/<nombre>`.
3. Expone endpoints de API (`/api/...`) y, cuando lleguen juegos en tiempo real, un servidor de
   Socket.IO en el mismo proceso.

Todo en un solo contenedor Docker (ver [12](12-docker-y-despliegue.md)) porque tu servidor tiene
8GB de RAM — un proceso Node compartido es mucho más liviano que uno por juego.

## Juegos estáticos vs juegos con servidor

| Tipo        | Necesita `server.js` para jugarse   | Ejemplo         |
|-------------|--------------------------------------|-----------------|
| Estático    | No (solo para servir los archivos)   | Snake, 2048     |
| Tiempo real | Sí, con estado en memoria + Socket.IO | Pong, cualquier 1v1 |

`games.json` (en `hub/`) es la lista que alimenta el hub — cada juego que agregues se registra ahí
con su nombre, ruta y una descripción corta. El hub la lee vía `GET /api/juegos` (ver
[05](05-que-es-rest.md)).
