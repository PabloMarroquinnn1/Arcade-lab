# 03 – Qué es REST

REST es un **estilo** para diseñar APIs sobre HTTP (no es un protocolo ni una librería). La idea
central: todo son **recursos** (juegos, jugadores, partidas...), identificados por una URL, y usas
el **verbo HTTP** para decir qué quieres hacer con ese recurso.

| Verbo     | Para qué    | Ejemplo |
|-----------|-------------|---------|
| GET       | leer        | `GET /api/juegos` → lista de juegos |
| POST      | crear       | `POST /api/juegos` → agregar un juego nuevo |
| PUT/PATCH | actualizar  | `PATCH /api/juegos/pong` → editar datos de Pong |
| DELETE    | borrar      | `DELETE /api/juegos/pong` |

## Códigos de estado

El servidor no solo responde datos, responde un **código** que dice cómo salió:

- `200 OK` — todo bien
- `201 Created` — se creó algo (típico tras un POST)
- `400 Bad Request` — el cliente mandó algo mal formado
- `404 Not Found` — el recurso no existe
- `500 Internal Server Error` — se rompió algo en el servidor

En `server.js`:

```js
if (err) return res.status(500).json({ error: 'No se pudo leer la lista de juegos' });
res.json(JSON.parse(data));
```

Si algo falla al leer el archivo, respondemos `500` explícito en vez de dejar que el cliente
reciba una respuesta rota sin explicación.

## Por qué importa para el arcade

Cuando agreguemos un leaderboard o guardado de partidas, en vez de inventar nuestro propio formato
raro, seguimos esta convención: `GET /api/partidas`, `POST /api/partidas`, etc. Cualquiera que
conozca REST (tú en 6 meses, u otra persona) entiende la API sin leer el código.
