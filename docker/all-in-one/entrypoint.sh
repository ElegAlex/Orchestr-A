#!/bin/bash
set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    ORCHESTR'A                             ║"
echo "║              All-in-One Container                         ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# Get PostgreSQL version
PG_VERSION=$(cat /tmp/pg_version)
echo "▶ PostgreSQL version: $PG_VERSION"

# Generate JWT_SECRET if default or not set
if [ "$JWT_SECRET" = "change-me-in-production-minimum-32-characters" ] || [ -z "$JWT_SECRET" ]; then
    export JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
    echo "⚠ JWT_SECRET généré automatiquement (non persistant entre redémarrages)"
    echo "  Pour persister, relancez avec: -e JWT_SECRET=votre_secret"
fi

# Initialize PostgreSQL if needed
if [ ! -f /data/postgresql/PG_VERSION ]; then
    echo "▶ Initialisation de PostgreSQL..."
    chown -R postgres:postgres /data/postgresql
    gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/initdb -D /data/postgresql --encoding=UTF8 --locale=C.UTF-8

    # Configure authentication
    cat >> /data/postgresql/pg_hba.conf << EOF
# Allow local connections
local   all             all                                     trust
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
EOF

    # Configure PostgreSQL for container
    cat >> /data/postgresql/postgresql.conf << EOF
# Container optimizations
listen_addresses = 'localhost'
max_connections = 100
shared_buffers = 128MB
EOF
fi

# Ensure correct ownership
chown -R postgres:postgres /data/postgresql /run/postgresql

# Start PostgreSQL temporarily for initialization
echo "▶ Démarrage temporaire de PostgreSQL..."
gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/pg_ctl -D /data/postgresql -w start -o "-c listen_addresses=localhost"

# Create database and user if needed
if ! gosu postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='orchestr_a'" | grep -q 1; then
    echo "▶ Création de la base de données..."
    gosu postgres psql -c "CREATE USER orchestr_a WITH PASSWORD 'orchestr_a';"
    gosu postgres psql -c "CREATE DATABASE orchestr_a OWNER orchestr_a;"
    gosu postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE orchestr_a TO orchestr_a;"
    gosu postgres psql -d orchestr_a -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
fi

# Run Prisma migrations
echo "▶ Exécution des migrations Prisma..."
cd /app
export DATABASE_URL="postgresql://orchestr_a:orchestr_a@localhost:5432/orchestr_a"
npx prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma

# Seed database if empty (check if users table exists and has data)
USER_COUNT=$(gosu postgres psql -d orchestr_a -tAc "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "error")
if [ "$USER_COUNT" = "0" ] || [ "$USER_COUNT" = "error" ]; then
    echo "▶ Création de l'utilisateur admin par défaut..."
    # Create admin user directly via SQL (password: admin123)
    # Hash generated with bcrypt, rounds=12
    gosu postgres psql -d orchestr_a -c "
        INSERT INTO users (id, email, login, \"passwordHash\", \"firstName\", \"lastName\", role, \"isActive\", \"createdAt\", \"updatedAt\")
        VALUES (
            gen_random_uuid()::text,
            'admin@orchestr-a.local',
            'admin',
            '\$2b\$12\$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG',
            'Admin',
            'Orchestr-A',
            'ADMIN',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (email) DO NOTHING;
    " 2>/dev/null || echo "  (utilisateur admin peut déjà exister)"
fi

# Stop PostgreSQL (supervisord will restart it)
echo "▶ Arrêt temporaire de PostgreSQL..."
gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/pg_ctl -D /data/postgresql -w stop

# Initialize Redis directory
mkdir -p /data/redis
chmod 755 /data/redis

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Orchestr'A démarrage des services..."
echo "  Interface web: http://localhost:3000"
echo "  API:          http://localhost:3000/api"
echo "  Documentation: http://localhost:3000/api/docs"
echo ""
echo "  Login par défaut: admin / admin123"
echo "════════════════════════════════════════════════════════════"
echo ""

exec "$@"
