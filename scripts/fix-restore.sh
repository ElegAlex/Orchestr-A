#!/bin/bash
# =============================================================================
# fix-restore.sh — Restauration de la base Orchestr'A apres perte de donnees
# =============================================================================
#
# Ce script :
#   1. Stoppe le conteneur Orchestr'A (en boucle restart)
#   2. Lance un conteneur temporaire avec acces au volume /data et au dump
#   3. Demarre PostgreSQL, vide la base, restaure le dump, corrige les droits
#   4. Verifie que l'utilisateur orchestr_a voit bien les donnees
#   5. Relance le conteneur Orchestr'A
#
# Usage : sudo bash fix-restore.sh
# =============================================================================

set -e

# ─── VARIABLES A ADAPTER SI NECESSAIRE ──────────────────────────────────────

# Nom du conteneur Orchestr'A (visible via docker ps -a)
CONTAINER="orchestr-a-orchestr-a-1"

# Chemin du dump sur le serveur hote
DUMP_PATH="/docker/backup/orchestr-a-backup-06032026.dump"

# Image Docker a utiliser (meme image que le conteneur)
IMAGE="orchestr-a:local"

# Repertoire de travail compose de Bobby
COMPOSE_DIR="/docker/orchestr-a-v3-06032026"

# ─── FONCTIONS ──────────────────────────────────────────────────────────────

rouge()  { echo -e "\033[0;31m$1\033[0m"; }
vert()   { echo -e "\033[0;32m$1\033[0m"; }
jaune()  { echo -e "\033[0;33m$1\033[0m"; }
etape()  { echo ""; echo "═══════════════════════════════════════════════════"; echo "▶ $1"; echo "═══════════════════════════════════════════════════"; }

verifier_erreur() {
    if [ $? -ne 0 ]; then
        rouge "ECHEC : $1"
        rouge "Le script s'arrete. Aucune modification n'a ete appliquee au conteneur principal."
        exit 1
    fi
}

# ─── VERIFICATIONS PREALABLES ───────────────────────────────────────────────

etape "ETAPE 0 — Verifications prealables"

# Docker disponible ?
if ! command -v docker &> /dev/null; then
    rouge "ERREUR : docker n'est pas dans le PATH"
    exit 1
fi
vert "  OK : docker disponible"

# Le conteneur existe ?
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    rouge "ERREUR : conteneur '$CONTAINER' introuvable"
    echo "  Conteneurs disponibles :"
    docker ps -a --format '  - {{.Names}} ({{.Status}})'
    exit 1
fi
vert "  OK : conteneur '$CONTAINER' trouve"

# Le dump existe ?
if [ ! -f "$DUMP_PATH" ]; then
    rouge "ERREUR : dump introuvable a '$DUMP_PATH'"
    echo "  Fichiers dans $(dirname "$DUMP_PATH") :"
    ls -lh "$(dirname "$DUMP_PATH")" 2>/dev/null || echo "  (repertoire inexistant)"
    exit 1
fi
DUMP_SIZE=$(du -h "$DUMP_PATH" | cut -f1)
vert "  OK : dump trouve ($DUMP_SIZE)"

# L'image existe localement ?
if ! docker image inspect "$IMAGE" &> /dev/null; then
    rouge "ERREUR : image '$IMAGE' introuvable localement"
    echo "  Images disponibles :"
    docker images --format '  - {{.Repository}}:{{.Tag}}' | grep -i orchestr
    exit 1
fi
vert "  OK : image '$IMAGE' disponible"

# Le fichier SQL de fix existe a cote de ce script ?
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_FIX="$SCRIPT_DIR/fix-restore.sql"
if [ ! -f "$SQL_FIX" ]; then
    rouge "ERREUR : fix-restore.sql introuvable dans $SCRIPT_DIR"
    echo "  Ce fichier doit etre dans le meme repertoire que fix-restore.sh"
    exit 1
fi
vert "  OK : fix-restore.sql trouve"

# ─── ETAPE 1 : STOPPER LE CONTENEUR ────────────────────────────────────────

etape "ETAPE 1 — Arret du conteneur '$CONTAINER'"

echo "  Etat actuel :"
docker ps -a --format '  {{.Names}} — {{.Status}}' --filter "name=$CONTAINER"

docker stop "$CONTAINER" 2>/dev/null || true
echo "  Attente de l'arret complet..."
sleep 3

# Verifier qu'il est bien stoppe
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    rouge "ERREUR : le conteneur ne s'est pas arrete"
    echo "  Tentative de kill..."
    docker kill "$CONTAINER" 2>/dev/null || true
    sleep 2
fi
vert "  OK : conteneur stoppe"

# ─── ETAPE 2 : RESTAURATION VIA CONTENEUR TEMPORAIRE ───────────────────────

etape "ETAPE 2 — Lancement du conteneur temporaire"

echo "  - --entrypoint bash : bypass de l'entrypoint Orchestr'A"
echo "  - --volumes-from    : acces au volume /data du conteneur"
echo "  - -v bind mount     : acces au dump et au SQL depuis l'hote"

# Nom du repertoire contenant le dump (pour le bind mount)
DUMP_DIR="$(dirname "$DUMP_PATH")"
DUMP_FILE="$(basename "$DUMP_PATH")"

docker run --rm \
    --name orchestr-a-fix-temp \
    --entrypoint bash \
    --volumes-from "$CONTAINER" \
    -v "$DUMP_DIR:/backup:ro" \
    -v "$SQL_FIX:/fix-restore.sql:ro" \
    "$IMAGE" \
    -c '
set -e

echo ""
echo "=== Conteneur temporaire demarre ==="
echo ""

# Recuperer la version PG (stockee dans l image)
PG_VERSION=$(cat /tmp/pg_version)
echo "  Version PostgreSQL : $PG_VERSION"

# Verifier que /data/postgresql contient un cluster
if [ ! -f /data/postgresql/PG_VERSION ]; then
    echo "ERREUR CRITIQUE : /data/postgresql/PG_VERSION absent"
    echo "  Le volume /data ne contient pas de cluster PostgreSQL"
    echo "  Contenu de /data/postgresql :"
    ls -la /data/postgresql/ 2>/dev/null || echo "  (repertoire vide ou inexistant)"
    exit 1
fi
echo "  OK : cluster PG detecte (version $(cat /data/postgresql/PG_VERSION))"

# Verifier que le dump est accessible
if [ ! -f "/backup/'"$DUMP_FILE"'" ]; then
    echo "ERREUR : dump introuvable dans /backup/"
    echo "  Contenu de /backup :"
    ls -la /backup/
    exit 1
fi
echo "  OK : dump accessible (/backup/'"$DUMP_FILE"')"

# Corriger les permissions (necessaire car le conteneur tourne en root)
chown -R postgres:postgres /data/postgresql /run/postgresql

echo ""
echo "--- Demarrage de PostgreSQL ---"
gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/pg_ctl \
    -D /data/postgresql -w start \
    -o "-c listen_addresses=localhost"
echo "  OK : PostgreSQL demarre"

# Verifier que la base orchestr_a existe
if ! gosu postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='"'"'orchestr_a'"'"'" | grep -q 1; then
    echo "ERREUR : la base orchestr_a n existe pas"
    echo "  Bases disponibles :"
    gosu postgres psql -l
    gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/pg_ctl -D /data/postgresql -w stop
    exit 1
fi
echo "  OK : base orchestr_a existe"

# Etat avant restauration
echo ""
echo "--- Etat AVANT restauration ---"
USERS_BEFORE=$(gosu postgres psql -d orchestr_a -tAc "SELECT count(*) FROM users;" 2>/dev/null || echo "erreur")
echo "  Utilisateurs : $USERS_BEFORE"
MIGRATIONS_BEFORE=$(gosu postgres psql -d orchestr_a -tAc "SELECT count(*) FROM _prisma_migrations;" 2>/dev/null || echo "table absente")
echo "  Migrations   : $MIGRATIONS_BEFORE"

echo ""
echo "--- Nettoyage du schema public ---"
gosu postgres psql -d orchestr_a -c "DROP SCHEMA public CASCADE;"
gosu postgres psql -d orchestr_a -c "CREATE SCHEMA public;"
gosu postgres psql -d orchestr_a -c "GRANT ALL ON SCHEMA public TO postgres;"
echo "  OK : schema public recree (vide)"

echo ""
echo "--- Restauration du dump ---"
echo "  Fichier : /backup/'"$DUMP_FILE"'"
echo "  Cela peut prendre quelques minutes..."
echo ""

# pg_restore : -U postgres car orchestr_a n est pas superuser
# --no-owner : ne pas tenter de restaurer les proprietaires d origine
# --no-privileges : ne pas restaurer les GRANT d origine
# --single-transaction : tout ou rien
# exit code 0 = succes, 1 = warnings (normal avec --clean absent apres DROP)
gosu postgres pg_restore \
    -U postgres \
    -d orchestr_a \
    --no-owner \
    --no-privileges \
    --verbose \
    --single-transaction \
    "/backup/'"$DUMP_FILE"'" 2>&1 | tail -20

RESTORE_EXIT=${PIPESTATUS[0]}
if [ "$RESTORE_EXIT" -ne 0 ] && [ "$RESTORE_EXIT" -ne 1 ]; then
    echo ""
    echo "ERREUR : pg_restore a echoue (code $RESTORE_EXIT)"
    gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/pg_ctl -D /data/postgresql -w stop
    exit 1
fi
echo ""
echo "  OK : pg_restore termine (code sortie : $RESTORE_EXIT)"

echo ""
echo "--- Application des corrections de droits ---"
gosu postgres psql -d orchestr_a -f /fix-restore.sql
echo "  OK : droits corriges"

echo ""
echo "--- Verification APRES restauration (en tant que postgres) ---"
echo "  Tables dans public :"
gosu postgres psql -d orchestr_a -c "SELECT tablename FROM pg_tables WHERE schemaname = '"'"'public'"'"' ORDER BY tablename;"

USERS_AFTER=$(gosu postgres psql -d orchestr_a -tAc "SELECT count(*) FROM users;")
PROJECTS_AFTER=$(gosu postgres psql -d orchestr_a -tAc "SELECT count(*) FROM projects;" 2>/dev/null || echo "0")
TASKS_AFTER=$(gosu postgres psql -d orchestr_a -tAc "SELECT count(*) FROM tasks;" 2>/dev/null || echo "0")
MIGRATIONS_AFTER=$(gosu postgres psql -d orchestr_a -tAc "SELECT count(*) FROM _prisma_migrations;" 2>/dev/null || echo "0")

echo ""
echo "  Utilisateurs : $USERS_AFTER"
echo "  Projets      : $PROJECTS_AFTER"
echo "  Taches       : $TASKS_AFTER"
echo "  Migrations   : $MIGRATIONS_AFTER"

echo ""
echo "--- Verification CRITIQUE : acces en tant que orchestr_a ---"
echo "  (C est le test decisif : Prisma utilise cet utilisateur)"

USERS_CHECK=$(PGPASSWORD=orchestr_a psql -U orchestr_a -h localhost -d orchestr_a -tAc "SELECT count(*) FROM users;" 2>&1)
if echo "$USERS_CHECK" | grep -qE "^[0-9]+$"; then
    echo "  OK : orchestr_a voit $USERS_CHECK utilisateur(s)"
else
    echo "  ECHEC : orchestr_a ne peut pas lire la table users"
    echo "  Erreur : $USERS_CHECK"
    echo ""
    echo "  Verification du proprietaire du schema public :"
    gosu postgres psql -d orchestr_a -c "SELECT nspname, nspowner::regrole FROM pg_namespace WHERE nspname = '"'"'public'"'"';"
    echo ""
    echo "  Le conteneur principal risque de boucler a nouveau."
    echo "  Arret de PostgreSQL..."
    gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/pg_ctl -D /data/postgresql -w stop
    exit 1
fi

MIGRATIONS_CHECK=$(PGPASSWORD=orchestr_a psql -U orchestr_a -h localhost -d orchestr_a -tAc "SELECT count(*) FROM _prisma_migrations;" 2>&1)
if echo "$MIGRATIONS_CHECK" | grep -qE "^[0-9]+$"; then
    echo "  OK : orchestr_a voit $MIGRATIONS_CHECK migration(s) dans _prisma_migrations"
else
    echo "  ECHEC : orchestr_a ne peut pas lire _prisma_migrations"
    echo "  Erreur : $MIGRATIONS_CHECK"
    gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/pg_ctl -D /data/postgresql -w stop
    exit 1
fi

echo ""
echo "--- Arret propre de PostgreSQL ---"
gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/pg_ctl -D /data/postgresql -w stop
echo "  OK : PostgreSQL arrete proprement"

echo ""
echo "=========================================="
echo "  RESTAURATION TERMINEE AVEC SUCCES"
echo "  Utilisateurs : $USERS_AFTER"
echo "  Projets      : $PROJECTS_AFTER"
echo "  Taches       : $TASKS_AFTER"
echo "  Migrations   : $MIGRATIONS_AFTER"
echo "=========================================="
echo ""
'

TEMP_EXIT=$?
if [ $TEMP_EXIT -ne 0 ]; then
    rouge "Le conteneur temporaire a echoue (code $TEMP_EXIT)"
    rouge "Le conteneur principal n'a PAS ete relance."
    rouge "Vous pouvez relancer ce script apres avoir corrige le probleme."
    exit 1
fi

# ─── ETAPE 3 : RELANCER LE CONTENEUR ───────────────────────────────────────

etape "ETAPE 3 — Relance du conteneur '$CONTAINER'"

docker start "$CONTAINER"
vert "  OK : conteneur relance"

echo "  Attente du demarrage (60 secondes)..."
echo ""
for i in $(seq 1 12); do
    sleep 5
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "inconnu")
    RUNNING=$(docker inspect --format='{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo "false")
    if [ "$RUNNING" = "false" ]; then
        jaune "  [${i}/12] Conteneur stoppe — il redemarre peut-etre..."
    elif [ "$STATUS" = "healthy" ]; then
        vert "  [${i}/12] HEALTHY"
        break
    else
        echo "  [${i}/12] Status: $STATUS (running: $RUNNING)"
    fi
done

echo ""

# ─── ETAPE 4 : VERIFICATION FINALE ─────────────────────────────────────────

etape "ETAPE 4 — Verification finale"

# Afficher les dernieres lignes de log
echo "--- 30 dernieres lignes de log ---"
echo ""
docker logs --tail 30 "$CONTAINER" 2>&1
echo ""

# Verifier l'etat
FINAL_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "inconnu")
FINAL_RUNNING=$(docker inspect --format='{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo "false")

echo "--- Etat du conteneur ---"
echo "  Running : $FINAL_RUNNING"
echo "  Health  : $FINAL_STATUS"
echo ""

if [ "$FINAL_STATUS" = "healthy" ]; then
    vert "=========================================="
    vert "  SUCCES COMPLET"
    vert "  Le conteneur est healthy."
    vert "  Verifiez l'application dans le navigateur."
    vert "=========================================="
elif [ "$FINAL_RUNNING" = "true" ]; then
    jaune "=========================================="
    jaune "  CONTENEUR EN COURS DE DEMARRAGE"
    jaune "  Status: $FINAL_STATUS"
    jaune "  Le health check peut prendre 90 secondes."
    jaune "  Verifiez avec : docker logs -f $CONTAINER"
    jaune "=========================================="
else
    rouge "=========================================="
    rouge "  PROBLEME : le conteneur n'est pas running"
    rouge "  Consultez les logs : docker logs $CONTAINER"
    rouge "=========================================="
    exit 1
fi
