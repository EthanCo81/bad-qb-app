FROM node:20-alpine

RUN apk add --no-cache tzdata

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

RUN mkdir -p /app/data && chown -R node:node /app
USER node

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
