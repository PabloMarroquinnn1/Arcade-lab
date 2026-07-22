FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY hub ./hub
COPY games ./games

EXPOSE 3000

USER node

CMD ["node", "server.js"]
