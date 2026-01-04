# ==================================
# Stage 1: Builder - Build l'application
# ==================================
FROM node:22-alpine AS builder

# Installation de pnpm
RUN npm install -g pnpm@9.15.0

# Création du répertoire de travail
WORKDIR /app

# Copie des fichiers de configuration du monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copie des packages nécessaires
COPY packages/database ./packages/database
COPY apps/api ./apps/api

# Installation des dépendances
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN pnpm install --frozen-lockfile || true
RUN pnpm install --frozen-lockfile --offline

# Génération du client Prisma (nécessaire pour les exports d'enums)
RUN cd packages/database && npx prisma generate

# Build de l'API
RUN pnpm --filter api run build

# ==================================
# Stage 2: Production - Image légère
# ==================================
FROM node:22-alpine AS production

# Installation de pnpm, netcat (pour healthcheck) et postgresql-client (pour seed)
RUN npm install -g pnpm@9.15.0 && apk add --no-cache netcat-openbsd postgresql-client

# Création de l'utilisateur non-root
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Création du répertoire de travail
WORKDIR /app

# Copie des fichiers de configuration
COPY --chown=nestjs:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=nestjs:nodejs apps/api/package.json ./apps/api/

# Copie du schema Prisma et génération du client
COPY --chown=nestjs:nodejs packages/database/package.json ./packages/database/
COPY --chown=nestjs:nodejs packages/database/prisma ./packages/database/prisma
COPY --chown=nestjs:nodejs packages/database/index.ts ./packages/database/
COPY --chown=nestjs:nodejs packages/database/tsconfig.json ./packages/database/

# Installation des dépendances de production uniquement (ignore scripts Husky)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Installation de prisma CLI globalement pour la génération du client
RUN npm install -g prisma@6.19.1

# Génération du client Prisma en production
RUN cd packages/database && prisma generate

# Copie du build depuis le stage builder
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copie et configuration de l'entrypoint (migrations automatiques)
COPY --chown=nestjs:nodejs apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Switch vers l'utilisateur non-root
USER nestjs

# Exposition du port
EXPOSE 4000

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=4000

# Healthcheck (start_period augmenté pour laisser le temps aux migrations)
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Entrypoint avec migrations automatiques
ENTRYPOINT ["/app/docker-entrypoint.sh"]
