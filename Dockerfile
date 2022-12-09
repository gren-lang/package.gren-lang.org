FROM node:18-bullseye-slim

WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm ci --omit=dev

COPY index.js .
COPY src/ src/
COPY public/ public/

CMD [ "node", "index.js" ]
