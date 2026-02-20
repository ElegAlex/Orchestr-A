#!/bin/bash
set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    ORCHESTR'A V2                          ║"
echo "║              Conteneur All-in-One                         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# ─── Fonctions utilitaires ───────────────────────────────────────

log_step() { echo "▶ $1"; }
log_ok()   { echo "  ✓ $1"; }
log_warn() { echo "  ⚠ $1"; }
log_err()  { echo "  ✗ ERREUR : $1"; }

abort() {
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "  ERREUR FATALE — Les services ne seront PAS démarrés."
    echo "  $1"
    echo "  Consultez les logs : docker logs orchestr-a"
    echo "════════════════════════════════════════════════════════════"
    exit 1
}

# ─── Détection du type d'installation ────────────────────────────

PG_VERSION=$(cat /tmp/pg_version)
IS_UPGRADE=false

if [ -f /data/postgresql/PG_VERSION ]; then
    IS_UPGRADE=true
    log_step "Installation existante détectée — mode MISE À JOUR"
else
    log_step "Aucune donnée trouvée — mode PREMIÈRE INSTALLATION"
fi

# ─── Gestion du JWT_SECRET ───────────────────────────────────────
# Priorité : 1) Variable d'env  2) Fichier persisté  3) Génération auto

log_step "Configuration du JWT_SECRET..."

if [ -n "$JWT_SECRET" ] && [ "$JWT_SECRET" != "change-me-in-production-minimum-32-characters" ]; then
    log_ok "JWT_SECRET fourni via variable d'environnement"
elif [ -f /data/.jwt_secret ]; then
    export JWT_SECRET=$(cat /data/.jwt_secret)
    log_ok "JWT_SECRET restauré depuis le fichier persisté"
else
    export JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
    echo "$JWT_SECRET" > /data/.jwt_secret
    chmod 600 /data/.jwt_secret
    log_ok "JWT_SECRET généré et persisté dans /data/.jwt_secret"
fi

# Toujours persister le secret pour les prochains redémarrages
if [ ! -f /data/.jwt_secret ] || [ "$(cat /data/.jwt_secret 2>/dev/null)" != "$JWT_SECRET" ]; then
    echo "$JWT_SECRET" > /data/.jwt_secret
    chmod 600 /data/.jwt_secret
fi

# ─── Initialisation PostgreSQL (première installation) ───────────

if [ "$IS_UPGRADE" = false ]; then
    log_step "Initialisation de PostgreSQL..."
    chown -R postgres:postgres /data/postgresql
    gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/initdb -D /data/postgresql --encoding=UTF8 --locale=C.UTF-8

    cat >> /data/postgresql/pg_hba.conf << EOF
# Allow local connections
local   all             all                                     trust
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
EOF

    cat >> /data/postgresql/postgresql.conf << EOF
# Container optimizations
listen_addresses = 'localhost'
max_connections = 100
shared_buffers = 128MB
EOF
    log_ok "PostgreSQL initialisé (version $PG_VERSION)"
fi

# Corriger les permissions (utile après restauration)
chown -R postgres:postgres /data/postgresql /run/postgresql

# ─── Démarrage temporaire de PostgreSQL ──────────────────────────

log_step "Démarrage temporaire de PostgreSQL..."
gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/pg_ctl -D /data/postgresql -w start -o "-c listen_addresses=localhost" \
    || abort "Impossible de démarrer PostgreSQL. La base de données est peut-être corrompue."
log_ok "PostgreSQL démarré"

# ─── Création base et utilisateur (si besoin) ────────────────────

if ! gosu postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='orchestr_a'" | grep -q 1; then
    log_step "Création de la base de données..."
    gosu postgres psql -c "CREATE USER orchestr_a WITH PASSWORD 'orchestr_a';" 2>/dev/null || true
    gosu postgres psql -c "CREATE DATABASE orchestr_a OWNER orchestr_a;"
    gosu postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE orchestr_a TO orchestr_a;"
    gosu postgres psql -d orchestr_a -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
    log_ok "Base de données 'orchestr_a' créée"
fi

# ─── Sauvegarde pré-migration (uniquement en mise à jour) ────────

export DATABASE_URL="postgresql://orchestr_a:orchestr_a@localhost:5432/orchestr_a"

if [ "$IS_UPGRADE" = true ]; then
    log_step "Sauvegarde pré-migration..."
    BACKUP_FILE="/data/backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql"
    if gosu postgres pg_dump -d orchestr_a > "$BACKUP_FILE" 2>/dev/null; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log_ok "Backup créé : $BACKUP_FILE ($BACKUP_SIZE)"
    else
        log_warn "Impossible de créer le backup (la mise à jour continue)"
    fi
fi

# ─── Migrations Prisma ───────────────────────────────────────────

log_step "Application des migrations Prisma..."
cd /app

# Compter les migrations avant
MIGRATIONS_BEFORE=$(gosu postgres psql -d orchestr_a -tAc "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;" 2>/dev/null || echo "0")

# Exécuter les migrations
if ! npx prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma 2>&1; then
    echo ""
    log_err "Les migrations ont échoué !"
    if [ -n "${BACKUP_FILE:-}" ]; then
        echo "  → Un backup est disponible : $BACKUP_FILE"
        echo "  → Pour restaurer : docker exec orchestr-a gosu postgres psql -d orchestr_a < $BACKUP_FILE"
    fi
    abort "Échec des migrations Prisma. Contactez le développeur."
fi

# Compter les migrations après
MIGRATIONS_AFTER=$(gosu postgres psql -d orchestr_a -tAc "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;" 2>/dev/null || echo "0")
MIGRATIONS_NEW=$((MIGRATIONS_AFTER - MIGRATIONS_BEFORE))

if [ "$MIGRATIONS_NEW" -gt 0 ] 2>/dev/null; then
    log_ok "Migration terminée. $MIGRATIONS_NEW nouvelle(s) migration(s) appliquée(s)."
else
    log_ok "Base de données à jour (aucune nouvelle migration)."
fi

# ─── Seed si base vide ───────────────────────────────────────────

USER_COUNT=$(gosu postgres psql -d orchestr_a -tAc "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "error")
if [ "$USER_COUNT" = "0" ] || [ "$USER_COUNT" = "error" ]; then
    log_step "Création de l'utilisateur admin par défaut..."
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
    log_ok "Utilisateur admin créé (login: admin / mot de passe: admin123)"
else
    log_ok "$USER_COUNT utilisateur(s) en base — seed ignoré"
fi

# ─── Arrêt temporaire de PostgreSQL ──────────────────────────────

log_step "Préparation au démarrage des services..."
gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/pg_ctl -D /data/postgresql -w stop

# ─── Initialisation Redis ────────────────────────────────────────

mkdir -p /data/redis
chmod 755 /data/redis

# ─── Démarrage ───────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✓ Orchestr'A — Démarrage des services..."
echo ""
echo "  Interface web : http://localhost:3000"
echo "  API :           http://localhost:3000/api"
if [ "${SWAGGER_ENABLED:-false}" = "true" ]; then
echo "  Documentation : http://localhost:3000/api/docs"
fi
echo ""
if [ "$IS_UPGRADE" = true ]; then
echo "  Mode : MISE À JOUR ($MIGRATIONS_NEW migration(s) appliquée(s))"
else
echo "  Mode : PREMIÈRE INSTALLATION"
echo "  Login par défaut : admin / admin123"
fi
echo "════════════════════════════════════════════════════════════"
echo ""

exec "$@"
