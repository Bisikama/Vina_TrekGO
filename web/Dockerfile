# syntax=docker/dockerfile:1
# TrekGO Web (Next.js standalone) - lắng nghe cổng 5000

# ---------- Stage 1: cài dependencies ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Stage 2: build ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* và rewrites trong next.config.ts được nhúng cứng lúc BUILD,
# đổi URL API thì phải build lại image.
ARG NEXT_PUBLIC_API_URL=https://api.trekgo.website
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- Stage 3: runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=5000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

USER app
EXPOSE 5000
CMD ["node", "server.js"]
