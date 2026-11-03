# syntax=docker/dockerfile:1

# ---------- Stage 1: install deps + build ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# openssl is required by the Prisma engines
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
# config.ts validates env at import time; the build itself does not import it
RUN NODE_ENV=production npm run build

# Drop devDependencies but keep the generated Prisma client (node_modules/.prisma)
RUN npm prune --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma

USER node
EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
# Apply pending migrations (additive only, never resets data), then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
