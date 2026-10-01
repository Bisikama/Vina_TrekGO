# syntax=docker/dockerfile:1

# ---------------------------------------------------
# Stage 1: Build stage
# ---------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install openssl and ca-certificates needed for Prisma CLI
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests and Prisma schema first for better caching
COPY package*.json ./
COPY prisma ./prisma

# Install all dependencies (including devDependencies required for compilation)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy application source code and configuration files
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Build the NestJS application
RUN npm run build

# Prune devDependencies to keep runtime node_modules minimal
RUN npm prune --omit=dev

# ---------------------------------------------------
# Stage 2: Production runner stage
# ---------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install runtime dependencies:
# - openssl: required by Prisma engine
# - ca-certificates: secure HTTPS requests (Supabase, Cloudinary, etc.)
# - dumb-init: handle signal forwarding (SIGTERM/SIGINT) for graceful shutdown
RUN apt-get update && apt-get install -y openssl ca-certificates dumb-init && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

# Copy build artifacts and dependencies from builder stage
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma

# Create default .env file so runtime environment checks pass when env vars are injected directly
RUN touch .env && chown node:node .env

# Ensure compatibility whether TypeScript emits to dist/src/main.js or dist/main.js
RUN if [ -f dist/src/main.js ] && [ ! -f dist/main.js ]; then ln -s src/main.js dist/main.js; \
    elif [ -f dist/main.js ] && [ ! -f dist/src/main.js ]; then mkdir -p dist/src && ln -s ../main.js dist/src/main.js; fi

# Run container as non-root user
USER node

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
