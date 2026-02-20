#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  ORCHESTR'A V2 — Script de retour arrière (rollback)
#  Usage : bash rollback.sh
# ═══════════════════════════════════════════════════════════════

set -e

# Couleurs
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[0;33m'
    NC='\033[0m'
else
    GREEN='' RED='' YELLOW='' NC=''
fi

CONTAINER_NAME="orchestr-a"
IMAGE_NAME="ghcr.io/elegalex/orchestr-a:latest"
IMAGE_PREVIOUS="ghcr.io/elegalex/orchestr-a:previous"
HEALTH_TIMEOUT=180
HEALTH_INTERVAL=5

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }

abort() {
    echo ""
    fail "$1"
    echo ""
    echo "Le rollback a échoué. Contactez le développeur."
    exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  RETOUR ARRIÈRE ORCHESTR'A V2"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Ce script va :"
echo "  1. Vérifier qu'une version précédente existe"
echo "  2. Arrêter le container actuel"
echo "  3. Relancer avec la version précédente"
echo "  4. Restaurer la base de données depuis le backup"
echo ""

# ─── Vérifications ───────────────────────────────────────────────

echo "Étape 1/5 — Vérifications préalables..."

if ! command -v docker &>/dev/null || ! docker info &>/dev/null; then
    abort "Docker n'est pas disponible."
fi
ok "Docker opérationnel"

# Vérifier l'image previous
if ! docker image inspect "$IMAGE_PREVIOUS" &>/dev/null; then
    abort "Aucune image 'previous' trouvée.
  Le rollback n'est possible que si une mise à jour a été effectuée avec update.sh."
fi
ok "Image précédente trouvée"

# Chercher le backup le plus récent
BACKUP_FILE=$(ls -t backup_orchestr-a_*.sql 2>/dev/null | head -1)
if [ -z "$BACKUP_FILE" ]; then
    warn "Aucun fichier backup trouvé dans le répertoire courant."
    echo "  Le rollback de l'image sera effectué SANS restauration de la base."
    echo ""
    read -p "Continuer quand même ? (oui/non) : " CONFIRM
    if [ "$CONFIRM" != "oui" ] && [ "$CONFIRM" != "o" ] && [ "$CONFIRM" != "yes" ] && [ "$CONFIRM" != "y" ]; then
        echo "Rollback annulé."
        exit 0
    fi
    RESTORE_DB=false
else
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    ok "Backup trouvé : $BACKUP_FILE ($BACKUP_SIZE)"
    RESTORE_DB=true
fi
echo ""

# ─── Confirmation ────────────────────────────────────────────────

read -p "Voulez-vous revenir à la version précédente ? (oui/non) : " CONFIRM
if [ "$CONFIRM" != "oui" ] && [ "$CONFIRM" != "o" ] && [ "$CONFIRM" != "yes" ] && [ "$CONFIRM" != "y" ]; then
    echo "Rollback annulé."
    exit 0
fi
echo ""

# ─── Récupération des paramètres ─────────────────────────────────

echo "Étape 2/5 — Récupération des paramètres..."

CONTAINER_VOLUME="orchestr-a-data"
CONTAINER_PORT="3000"

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    CONTAINER_VOLUME=$(docker inspect "$CONTAINER_NAME" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || echo "orchestr-a-data")
    CONTAINER_PORT=$(docker inspect "$CONTAINER_NAME" --format '{{range $p, $conf := .NetworkSettings.Ports}}{{if eq $p "3000/tcp"}}{{(index $conf 0).HostPort}}{{end}}{{end}}' 2>/dev/null || echo "3000")
fi

CONTAINER_VOLUME="${CONTAINER_VOLUME:-orchestr-a-data}"
CONTAINER_PORT="${CONTAINER_PORT:-3000}"

ok "Port: $CONTAINER_PORT, Volume: $CONTAINER_VOLUME"
echo ""

# ─── Arrêt du container actuel ───────────────────────────────────

echo "Étape 3/5 — Arrêt du container actuel..."

docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
ok "Container arrêté"
echo ""

# ─── Relancement avec l'image précédente ─────────────────────────

echo "Étape 4/5 — Relancement avec la version précédente..."

docker tag "$IMAGE_PREVIOUS" "$IMAGE_NAME"

docker run -d --name "$CONTAINER_NAME" \
    -p "${CONTAINER_PORT}:3000" \
    -v "${CONTAINER_VOLUME}:/data" \
    --restart unless-stopped \
    "$IMAGE_NAME" >/dev/null 2>&1 \
    || abort "Impossible de lancer le container avec l'ancienne version."

ok "Container lancé avec l'image précédente"
echo ""

# ─── Restauration de la base de données ──────────────────────────

echo "Étape 5/5 — Restauration de la base de données..."

if [ "$RESTORE_DB" = true ]; then
    echo "  Attente du démarrage de PostgreSQL..."
    sleep 15

    # Attendre que PostgreSQL soit prêt
    ELAPSED=0
    while [ $ELAPSED -lt 60 ]; do
        if docker exec "$CONTAINER_NAME" gosu postgres psql -d orchestr_a -c "SELECT 1;" &>/dev/null; then
            break
        fi
        sleep 3
        ELAPSED=$((ELAPSED + 3))
    done

    if [ $ELAPSED -ge 60 ]; then
        warn "PostgreSQL n'a pas démarré dans le temps imparti."
        echo "  La base n'a pas été restaurée. Restauration manuelle :"
        echo "  docker exec -i $CONTAINER_NAME gosu postgres psql -d orchestr_a < $BACKUP_FILE"
    else
        # Restaurer le backup
        if docker exec -i "$CONTAINER_NAME" gosu postgres psql -d orchestr_a < "$BACKUP_FILE" >/dev/null 2>&1; then
            ok "Base de données restaurée depuis $BACKUP_FILE"
        else
            warn "La restauration a rencontré des erreurs (certaines sont normales si le schéma n'a pas changé)."
            echo "  Vérifiez les données dans l'application."
        fi
    fi
else
    warn "Pas de backup à restaurer — la base conserve les données actuelles."
fi
echo ""

# ─── Attente du health check ─────────────────────────────────────

echo "  Vérification du démarrage..."

ELAPSED=0
while [ $ELAPSED -lt $HEALTH_TIMEOUT ]; do
    if docker exec "$CONTAINER_NAME" /healthcheck.sh &>/dev/null; then
        break
    fi
    sleep $HEALTH_INTERVAL
    ELAPSED=$((ELAPSED + HEALTH_INTERVAL))
done

echo ""

if [ $ELAPSED -ge $HEALTH_TIMEOUT ]; then
    warn "Le health check n'a pas répondu dans le temps imparti."
    echo "  Vérifiez les logs : docker logs $CONTAINER_NAME"
    exit 1
fi

# ─── Résultat ────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  ✓  ROLLBACK TERMINÉ AVEC SUCCÈS !"
echo ""
echo "  L'application est accessible sur :"
echo "  → http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):${CONTAINER_PORT}"
echo ""
echo "  La version précédente est restaurée."
echo "  Contactez le développeur pour signaler le problème."
echo ""
echo "═══════════════════════════════════════════════════════════"
