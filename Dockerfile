# =============================================================================
# Nexus Crypto Bot — multi-stage production Dockerfile
# =============================================================================

# ---- Stage 1: build ---------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (including dev deps for the build).
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Generate the Prisma client, then compile TypeScript.
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ---- Stage 2: production runtime -------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

# Copy compiled output from the builder stage.
COPY --from=builder /app/dist ./dist

# Run as the non-root user that ships with the node image.
USER node

# The HTTP API port (health/metrics/webhooks).
EXPOSE 3000

# Container-native health check hitting the liveness endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
