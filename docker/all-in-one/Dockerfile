# ============================================================
# Orchestr-A All-in-One Image
# Usage: docker run -d -p 3000:3000 -v orchestr-a-data:/data ghcr.io/elegalex/orchestr-a:latest
# ============================================================

# ----- Stage 1: Build API -----
FROM node:22-alpine AS api-builder

WORKDIR /build
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy monorepo config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy packages and apps
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies and build
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN pnpm install --frozen-lockfile
RUN cd packages/database && npx prisma generate
RUN pnpm run build --filter=api

# ----- Stage 2: Build Web -----
FROM node:22-alpine AS web-builder

WORKDIR /build
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy monorepo config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy packages and apps
COPY packages ./packages
COPY apps/web ./apps/web

# Install dependencies
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN pnpm install --frozen-lockfile
RUN cd packages/database && npx prisma generate

# Build with API URL for internal proxying
ENV NEXT_PUBLIC_API_URL=/api
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build --filter=web

# ----- Stage 3: Runtime All-in-One -----
FROM ubuntu:24.04

LABEL org.opencontainers.image.title="Orchestr-A All-in-One"
LABEL org.opencontainers.image.description="Application complète de gestion de projets pour collectivités"
LABEL org.opencontainers.image.source="https://github.com/ElegAlex/Orchestr-A"

# Avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Node.js (via NodeSource for v22)
    curl \
    ca-certificates \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
    nodejs \
    # Build tools for native modules (bcrypt)
    build-essential \
    python3 \
    # Database
    postgresql \
    postgresql-contrib \
    # Cache
    redis-server \
    # Reverse proxy
    nginx \
    # Process manager
    supervisor \
    # Utilities
    gosu \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm@9.15.9

# Get PostgreSQL version dynamically
RUN PG_VERSION=$(ls /usr/lib/postgresql/) && echo "PostgreSQL version: $PG_VERSION" && echo "$PG_VERSION" > /tmp/pg_version

# Create directories
RUN mkdir -p \
    /app/api \
    /app/web \
    /data/postgresql \
    /data/redis \
    /var/log/orchestr-a \
    /run/postgresql \
    && chown -R postgres:postgres /data/postgresql /run/postgresql

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma
COPY packages/database/index.ts ./packages/database/
COPY packages/database/tsconfig.json ./packages/database/

# Install production dependencies
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Rebuild bcrypt native module for the current platform
RUN cd node_modules/.pnpm/bcrypt@5.1.1/node_modules/bcrypt && npm run install

# Install prisma CLI and generate client
RUN npm install -g prisma@6.19.1 && cd packages/database && prisma generate

# Copy API build artifacts
COPY --from=api-builder /build/apps/api/dist ./apps/api/dist

# Copy Web build artifacts (standalone mode)
COPY --from=web-builder /build/apps/web/.next/standalone ./web
COPY --from=web-builder /build/apps/web/.next/static ./web/apps/web/.next/static
COPY --from=web-builder /build/apps/web/public ./web/apps/web/public

# Copy configuration files
COPY docker/all-in-one/supervisord.conf /etc/supervisor/conf.d/orchestr-a.conf
COPY docker/all-in-one/nginx.conf /etc/nginx/sites-available/default
COPY docker/all-in-one/entrypoint.sh /entrypoint.sh
COPY docker/all-in-one/healthcheck.sh /healthcheck.sh

RUN chmod +x /entrypoint.sh /healthcheck.sh

# Remove default nginx site and create symlink
RUN rm -f /etc/nginx/sites-enabled/default \
    && ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Default environment variables
ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_URL=postgresql://orchestr_a:orchestr_a@localhost:5432/orchestr_a \
    REDIS_HOST=localhost \
    REDIS_PORT=6379 \
    JWT_SECRET=change-me-in-production-minimum-32-characters \
    JWT_EXPIRES_IN=7d \
    CORS_ORIGIN=http://localhost:3000 \
    ALLOWED_ORIGINS=http://localhost:3000

# Exposed port (nginx reverse proxy)
EXPOSE 3000

# Volume for persistence
VOLUME ["/data"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD /healthcheck.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
