# 11 – Arquitectura cliente-servidor de este arcade

## Las dos partes

- **Cliente**: lo que corre en el navegador de quien juega — HTML, CSS, JS (`hub/`, y el frontend
  de cada juego en `games/<nombre>/`). No es de confiar: cualquiera puede abrir la consola y mandar
  lo que quiera.
- **Servidor**: el único `server.js`, corriendo en Node dentro de un contenedor Docker en tu HP con
  Ubuntu Server. Es la autoridad — decide qué es verdad (quién ganó, dónde está la pelota).

Así están armados Pong y Snake (modo 2 jugadores): el servidor calcula la física de la pelota (o
decide si una víbora chocó), y el cliente solo manda "quiero moverme para arriba" y dibuja lo que
el servidor le dice. Si el cliente pudiera decidir "gané", cualquiera podría hacer trampa editando
el JS del navegador. El patrón exacto que comparten los dos juegos está detallado en
[14 – La lógica de los juegos en tiempo real](14-logica-de-los-juegos-en-tiempo-real.md).

## Cómo se sirve todo en este repo

Un solo proceso Node (`server.js`) hace tres cosas:

1. Sirve `hub/` como archivos estáticos en `/` (la página principal del arcade).
2. Sirve cada `games/<nombre>/` como archivos estáticos en `/games/<nombre>`.
3. Expone endpoints de API (`/api/...`) y, cuando lleguen juegos en tiempo real, un servidor de
   Socket.IO en el mismo proceso.

Todo en un solo contenedor Docker (ver [12](12-docker-y-despliegue.md)) porque tu servidor tiene
8GB de RAM — un proceso Node compartido es mucho más liviano que uno por juego.

## Juegos estáticos vs juegos con servidor

Ojo: esto no es siempre "un juego = una categoría". Snake es el ejemplo perfecto de que **el mismo
juego** puede tener un modo de cada tipo:

| Tipo        | Necesita `server.js` para jugarse   | Ejemplo real en este repo |
|-------------|--------------------------------------|-----------------|
| Estático    | No (solo para servir los archivos)   | Snake modo solo |
| Tiempo real | Sí, con estado en memoria + Socket.IO | Pong, Snake modo 2 jugadores |

`games.json` (en `hub/`) es la lista que alimenta el hub — cada juego que agregues se registra ahí
con su nombre, ruta y una descripción corta. El hub la lee vía `GET /api/juegos` (ver
[05](05-que-es-rest.md)).
