# 08 – Docker y despliegue

## Qué es Docker, en corto

Docker empaqueta tu app + todo lo que necesita para correr (versión de Node, dependencias) en una
**imagen**. Un **contenedor** es esa imagen ya corriendo, aislada del resto del sistema operativo.
Ventaja principal para ti: en tu Ubuntu Server no necesitas instalar Node, ni preocuparte por
versiones — solo Docker.

## El Dockerfile de este repo, explicado

```dockerfile
FROM node:20-alpine       # imagen base: Node 20 sobre Alpine Linux (muy liviana, ideal para tu HP)
WORKDIR /app               # todo lo que sigue pasa dentro de /app en el contenedor
COPY package.json ./
RUN npm install --omit=dev # instala dependencias, sin las de desarrollo
COPY server.js ./
COPY hub ./hub
COPY games ./games
EXPOSE 3000                 # documenta qué puerto usa (no lo publica solo, eso lo hace docker-compose)
USER node                   # no correr como root dentro del contenedor
CMD ["node", "server.js"]   # comando que arranca al iniciar el contenedor
```

Copiamos `package.json` e instalamos dependencias **antes** de copiar el resto del código a
propósito: Docker cachea cada paso (*layer*). Si solo cambias `server.js`, Docker reusa el layer de
`npm install` en vez de reinstalar todo de cero — rebuilds mucho más rápidos.

## docker-compose.yml

```yaml
services:
  arcade:
    build: .
    container_name: arcade-lab
    ports:
      - "3000:3000"
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

`restart: unless-stopped` es importante en un servidor casero: si el proceso se cae o reinicias la
HP, el contenedor vuelve a levantarse solo.

## El flujo de trabajo en el servidor

```bash
git pull origin main
docker compose up --build -d
```

Cada vez que agregues un juego nuevo (nueva rama, merge a `develop`, merge a `main`), en el
servidor solo haces ese `pull` + `up --build -d`. Docker reconstruye la imagen con el código nuevo
y reemplaza el contenedor viejo, sin downtime perceptible para un proyecto de este tamaño.

## Cómo entra Cloudflare Tunnel en esto

Docker expone el contenedor en `localhost:3000` de tu HP. **No abres puertos en tu router.**
`cloudflared` corre en la misma máquina (fuera del contenedor, o como otro contenedor) y crea un
túnel saliente hacia Cloudflare, que a su vez le da una URL pública con HTTPS automático y la
conecta a tu `localhost:3000`. Tu Ubuntu Server nunca acepta conexiones entrantes directas de
internet — todo pasa primero por Cloudflare.
