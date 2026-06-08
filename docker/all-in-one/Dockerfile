# ============================================================
# Orchestr-A All-in-One Image
# Usage: docker run -d -p 80:80 -v orchestr-a-data:/data ghcr.io/elegalex/orchestr-a:latest
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

# ----- PostgreSQL 18 from PGDG (NOT Ubuntu stock 16) -----
# The source/prod database runs PostgreSQL 18. Ubuntu 24.04 ships PostgreSQL 16,
# and a logical pg_dump taken from 18 CANNOT be restored into 16 (unsupported
# downgrade) — a silent data-loss path on migration day that a same-version test
# would never catch. We therefore install PG18 from the PostgreSQL APT repo (PGDG)
# and ASSERT it is the only major present: the entrypoint and Dockerfile derive
# PG_VERSION from `ls /usr/lib/postgresql/`, so two majors => corrupted paths.
RUN install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-18 postgresql-contrib-18 \
    && rm -rf /var/lib/apt/lists/* \
    && INSTALLED="$(ls /usr/lib/postgresql/)" \
    && [ "$INSTALLED" = "18" ] || { echo "FATAL: expected exactly PostgreSQL 18, found: [$INSTALLED]"; exit 1; }

# Create non-root user for running application processes
RUN groupadd --system orchestr-a && useradd --system --gid orchestr-a --create-home orchestr-a

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

# Copy the rbac workspace package (TS sources consumed at runtime via the pnpm
# workspace link, exactly like `database`). apps/api depends on `rbac`
# (workspace:*); without this, pnpm cannot link it and the API dies at boot with
# `Cannot find module 'rbac'`. Mirrors the runtime stage of apps/api/Dockerfile.
COPY packages/rbac/package.json ./packages/rbac/
COPY packages/rbac/index.ts ./packages/rbac/
COPY packages/rbac/atomic-permissions.ts ./packages/rbac/
COPY packages/rbac/templates.ts ./packages/rbac/
COPY packages/rbac/tsconfig.json ./packages/rbac/

# Install production dependencies
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Rebuild bcrypt native module for the current platform. The pnpm store path is
# version-specific (bcrypt@X.Y.Z), so resolve it dynamically instead of hardcoding
# a version — a lockfile bump (e.g. 5.1.1 -> 6.0.0) must not break the build.
RUN set -e; \
    BCRYPT_DIR="$(find node_modules/.pnpm -maxdepth 1 -type d -name 'bcrypt@*' | head -1)/node_modules/bcrypt"; \
    test -d "$BCRYPT_DIR" || { echo "FATAL: bcrypt introuvable dans le store pnpm"; exit 1; }; \
    echo "Rebuild bcrypt: $BCRYPT_DIR"; \
    cd "$BCRYPT_DIR"; \
    npm run install

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

# Set ownership for application files so non-root user can run node processes
RUN chown -R orchestr-a:orchestr-a /app /var/log/orchestr-a

# Default environment variables
ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_URL=postgresql://orchestr_a:orchestr_a@localhost:5432/orchestr_a \
    REDIS_HOST=localhost \
    REDIS_PORT=6379 \
    JWT_SECRET="" \
    JWT_EXPIRES_IN=7d \
    CORS_ORIGIN=http://localhost:80 \
    ALLOWED_ORIGINS=http://localhost:80 \
    SWAGGER_ENABLED=false

# Exposed port (nginx reverse proxy)
EXPOSE 80

# Volume for persistence
VOLUME ["/data"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD /healthcheck.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
