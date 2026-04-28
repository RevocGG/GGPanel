# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline

# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for linux-musl target (Alpine)
RUN npx prisma generate
RUN npm run build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone server output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
COPY --from=builder /app/public           ./public

# Prisma engine + schema (needed at runtime for migrate)
COPY --from=builder /app/node_modules/.prisma            ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client     ./node_modules/@prisma/client
COPY --from=builder /app/prisma                           ./prisma

# Data directories (will be volume-mounted in production)
RUN mkdir -p data/cores data/configs \
 && chown -R nextjs:nodejs data

# Download goose-client binary for linux-amd64 (Docker is always linux)
RUN apk add --no-cache curl tar \
 && LATEST=$(curl -fsSL "https://api.github.com/repos/Kianmhz/GooseRelayVPN/releases/latest" \
      | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/') \
 && echo "Downloading GooseRelayVPN-client ${LATEST} linux-amd64" \
 && curl -fsSL "https://github.com/Kianmhz/GooseRelayVPN/releases/download/${LATEST}/GooseRelayVPN-client-${LATEST}-linux-amd64.tar.gz" \
      -o /tmp/goose-client.tar.gz \
 && mkdir -p /tmp/goose-extract \
 && tar xzf /tmp/goose-client.tar.gz -C /tmp/goose-extract \
 && find /tmp/goose-extract -name "goose-client" | head -1 | xargs -I{} cp {} data/cores/goose-client \
 && chmod +x data/cores/goose-client \
 && rm -rf /tmp/goose-client.tar.gz /tmp/goose-extract \
 && chown nextjs:nodejs data/cores/goose-client

VOLUME ["/app/data"]

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
