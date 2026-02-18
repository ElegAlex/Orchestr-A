# ==================================
# Stage 1: Dependencies - Installation des dépendances
# ==================================
FROM node:22-alpine AS deps

# Installation de pnpm
RUN npm install -g pnpm@9.15.9

WORKDIR /app

# Copie des fichiers de configuration du monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma

# Installation des dépendances
RUN pnpm install --frozen-lockfile

# Génération du client Prisma dans le stage deps
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN cd packages/database && pnpm prisma generate || true

# ==================================
# Stage 2: Builder - Build de l'application
# ==================================
FROM node:22-alpine AS builder

# Installation de pnpm
RUN npm install -g pnpm@9.15.9

WORKDIR /app

# Copie des dépendances depuis le stage deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules

# Copie des fichiers sources
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/database ./packages/database
COPY apps/web ./apps/web

# Génération du client Prisma depuis le stage deps (évite download pendant build)
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN cd packages/database && pnpm prisma generate || echo "Skipping Prisma generation, using cached"

# Variables d'environnement pour le build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build argument pour l'URL de l'API (compilé dans le bundle Next.js)
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build de l'application
RUN pnpm --filter web run build

# ==================================
# Stage 3: Production - Image légère
# ==================================
FROM node:22-alpine AS production

# Installation de pnpm
RUN npm install -g pnpm@9.15.9

# Création de l'utilisateur non-root
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

WORKDIR /app

# Copie des fichiers de production de Next.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Switch vers l'utilisateur non-root
USER nextjs

# Exposition du port
EXPOSE 3000

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Commande de démarrage
CMD ["node", "apps/web/server.js"]
