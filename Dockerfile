FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/server/package.json ./server/package.json
COPY --from=build --chown=node:node /app/server/dist ./server/dist
COPY --from=build --chown=node:node /app/server/prisma ./server/prisma
COPY --from=build --chown=node:node /app/server/prisma.config.ts ./server/prisma.config.ts
COPY --from=build --chown=node:node /app/client/dist ./client/dist
COPY --from=build --chown=node:node /app/client/package.json ./client/package.json
USER node
EXPOSE 4000
CMD ["sh", "-c", "npm run db:migrate && if [ \"$SEED_ON_START\" = \"true\" ]; then node server/dist/prisma/seed.js; fi && npm start"]
