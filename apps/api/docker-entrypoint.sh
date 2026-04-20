#!/bin/sh
# ============================================================================
# ORCHESTR'A API - Docker Entrypoint
# ============================================================================
# Executed at container startup:
# 1. Wait for PostgreSQL to be accessible
# 2. Run Prisma migrations automatically
# 3. Seed default data (admin user, leave types)
# 4. Start the NestJS application
# ============================================================================

set -e

echo "=================================================================="
echo "  ORCHESTR'A API - Container Starting"
echo "=================================================================="
echo ""

# ========================================
# 1. Wait for PostgreSQL
# ========================================
echo "[1/4] Checking database connectivity..."

# Extract host and port from DATABASE_URL if available
# Format: postgresql://user:pass@host:port/dbname
if [ -n "$DATABASE_URL" ]; then
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
else
    DB_HOST="${DB_HOST:-postgres}"
    DB_PORT="${DB_PORT:-5432}"
fi

echo "      Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."

# Wait for port to be accessible (max 60 seconds)
COUNTER=0
MAX_TRIES=30
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
    COUNTER=$((COUNTER + 1))
    if [ $COUNTER -ge $MAX_TRIES ]; then
        echo "      ERROR: PostgreSQL not reachable after ${MAX_TRIES} attempts"
        exit 1
    fi
    echo "      Attempt $COUNTER/$MAX_TRIES - waiting..."
    sleep 2
done

echo "      PostgreSQL is reachable"
echo ""

# ========================================
# 2. Run migrations
# ========================================
echo "[2/4] Running database migrations..."

cd /app/packages/database

# Prisma migrate deploy (safe for production)
# - Only applies pending migrations
# - Does not generate new migrations
if npx prisma migrate deploy; then
    echo "      Migrations applied successfully"
else
    echo "      WARNING: migrate deploy had issues"
    # Fallback to db push if migrations fail
    echo "      Attempting schema sync fallback..."
    npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || true
fi

echo ""

# ========================================
# 3. Seed default data
# ========================================
echo "[3/4] Checking default admin (SEC-02 gated)..."

# SEC-02: Never seed a hardcoded admin password. Admin bootstrap is
# handled by packages/database/prisma/seed.ts (env-gated) when operators
# explicitly run the seed with SEED_ADMIN_PASSWORD. At container start we
# simply check that at least one ADMIN user exists and emit a warning
# if none is present, so operators know to run the seed.

DB_USER=$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

ADMIN_COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM users u JOIN roles r ON u.\"roleId\" = r.id WHERE r.code = 'ADMIN' AND u.\"isActive\" = true;" 2>/dev/null || echo "0")

if [ "$ADMIN_COUNT" = "0" ]; then
    echo "      [SECURITY WARNING] No active ADMIN user found."
    echo "      [SECURITY WARNING] Run the seed with SEED_ADMIN_PASSWORD set to bootstrap."
else
    echo "      Active ADMIN users: $ADMIN_COUNT"
fi

echo ""

# ========================================
# 4. Start application
# ========================================
echo "[4/4] Starting NestJS application..."
echo ""
echo "=================================================================="
echo "  API Ready - Listening on port ${PORT:-4000}"
echo "=================================================================="
echo ""

cd /app
exec node apps/api/dist/main.js
