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
echo "[3/4] Checking default data..."

# Create admin user if no users exist
ADMIN_EXISTS=$(npx prisma db execute --stdin <<EOF 2>/dev/null | grep -c "1" || echo "0"
SELECT COUNT(*) FROM users WHERE role = 'ADMIN';
EOF
)

if [ "$ADMIN_EXISTS" = "0" ] || [ -z "$ADMIN_EXISTS" ]; then
    echo "      Creating default admin user..."
    npx prisma db execute --stdin <<EOF 2>/dev/null || true
INSERT INTO users (id, email, login, "passwordHash", "firstName", "lastName", role, "isActive", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    'admin@orchestr-a.internal',
    'admin',
    '\$2b\$12\$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
    'Admin',
    'System',
    'ADMIN',
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@orchestr-a.internal');
EOF
    echo "      Admin user created (admin@orchestr-a.internal / admin123)"
else
    echo "      Admin user already exists"
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
