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

VOLUME ["/app/data"]

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
