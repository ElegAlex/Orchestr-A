#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  ORCHESTR'A V2 — Script de mise à jour
#  Usage : bash update.sh
# ═══════════════════════════════════════════════════════════════

set -e

# Couleurs (désactivées si pas de terminal)
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
IMAGE_FILE="orchestr-a-latest.tar"
HEALTH_TIMEOUT=180
HEALTH_INTERVAL=5

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }

abort() {
    echo ""
    fail "$1"
    echo ""
    echo "La mise à jour a été interrompue. Aucune donnée n'a été perdue."
    echo "En cas de besoin, lancez : bash rollback.sh"
    exit 1
}

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  MISE À JOUR ORCHESTR'A V2"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Ce script va :"
echo "  1. Vérifier que Docker fonctionne"
echo "  2. Sauvegarder la base de données"
echo "  3. Mettre à jour l'application"
echo "  4. Vérifier que tout fonctionne"
echo ""
echo "Temps estimé : 5-10 minutes"
echo "L'application sera indisponible pendant 2-3 minutes."
echo ""

# ─── Vérification du fichier image ──────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "$IMAGE_FILE" ]; then
    abort "Fichier $IMAGE_FILE introuvable dans le dossier courant.
  Vérifiez que tous les fichiers du package sont présents."
fi

# ─── Confirmation ────────────────────────────────────────────────

read -p "Voulez-vous continuer ? (oui/non) : " CONFIRM
if [ "$CONFIRM" != "oui" ] && [ "$CONFIRM" != "o" ] && [ "$CONFIRM" != "yes" ] && [ "$CONFIRM" != "y" ]; then
    echo "Mise à jour annulée."
    exit 0
fi

echo ""

# ═══════════════════════════════════════════════════════════════
#  Étape 1/6 — Vérification de Docker
# ═══════════════════════════════════════════════════════════════

echo "Étape 1/6 — Vérification de Docker..."

if ! command -v docker &>/dev/null; then
    abort "Docker n'est pas installé.
  Installez Docker puis relancez ce script."
fi

if ! docker info &>/dev/null; then
    abort "Le service Docker ne tourne pas.
  Lancez : sudo systemctl start docker"
fi

DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "inconnue")
ok "Docker est opérationnel (version $DOCKER_VERSION)"
echo ""

# ═══════════════════════════════════════════════════════════════
#  Étape 2/6 — Vérification du container actuel
# ═══════════════════════════════════════════════════════════════

echo "Étape 2/6 — Vérification du container actuel..."

if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    abort "Le container '$CONTAINER_NAME' n'existe pas.
  Ce script est prévu pour une MISE À JOUR, pas une installation neuve."
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    warn "Le container '$CONTAINER_NAME' existe mais n'est pas en cours d'exécution."
    echo "  Tentative de démarrage pour la sauvegarde..."
    docker start "$CONTAINER_NAME" || abort "Impossible de démarrer le container pour la sauvegarde."
    sleep 10
fi

ok "Container '$CONTAINER_NAME' trouvé et actif"
echo ""

# ═══════════════════════════════════════════════════════════════
#  Étape 3/6 — Sauvegarde de la base de données
# ═══════════════════════════════════════════════════════════════

echo "Étape 3/6 — Sauvegarde de la base de données..."

BACKUP_FILE="backup_orchestr-a_$(date +%Y%m%d_%H%M%S).sql"

docker exec "$CONTAINER_NAME" gosu postgres pg_dump -d orchestr_a > "$BACKUP_FILE" 2>/dev/null \
    || abort "Impossible de créer le backup de la base de données.
  Vérifiez que PostgreSQL fonctionne dans le container."

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
ok "Backup créé : $BACKUP_FILE ($BACKUP_SIZE)"
echo ""

# ═══════════════════════════════════════════════════════════════
#  Étape 4/6 — Préparation de la mise à jour
# ═══════════════════════════════════════════════════════════════

echo "Étape 4/6 — Préparation de la mise à jour..."

# Sauvegarder les paramètres de lancement du container actuel
CONTAINER_VOLUME=$(docker inspect "$CONTAINER_NAME" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' 2>/dev/null)
CONTAINER_PORT=$(docker inspect "$CONTAINER_NAME" --format '{{range $p, $conf := .NetworkSettings.Ports}}{{if eq $p "3000/tcp"}}{{(index $conf 0).HostPort}}{{end}}{{end}}' 2>/dev/null)
CONTAINER_ENV=$(docker inspect "$CONTAINER_NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null)

# Valeurs par défaut si non trouvées
CONTAINER_VOLUME="${CONTAINER_VOLUME:-orchestr-a-data}"
CONTAINER_PORT="${CONTAINER_PORT:-3000}"

ok "Paramètres actuels récupérés (port: $CONTAINER_PORT, volume: $CONTAINER_VOLUME)"

# Tag de l'ancienne image pour rollback
CURRENT_IMAGE=$(docker inspect "$CONTAINER_NAME" --format '{{.Config.Image}}' 2>/dev/null || echo "$IMAGE_NAME")
docker tag "$CURRENT_IMAGE" "$IMAGE_PREVIOUS" 2>/dev/null \
    || warn "Impossible de taguer l'ancienne image (rollback par image non disponible)"

ok "Ancienne image taguée comme 'previous' pour rollback"

# Arrêt du container
echo "  Arrêt du container en cours..."
docker stop "$CONTAINER_NAME" >/dev/null 2>&1
docker rm "$CONTAINER_NAME" >/dev/null 2>&1
ok "Container arrêté et supprimé (les données sont conservées dans le volume)"
echo ""

# ═══════════════════════════════════════════════════════════════
#  Étape 5/6 — Chargement de la nouvelle image
# ═══════════════════════════════════════════════════════════════

echo "Étape 5/6 — Chargement de la nouvelle image..."
echo "  (cela peut prendre 1-2 minutes selon la taille de l'image)"

if ! docker load -i "$IMAGE_FILE" 2>/dev/null; then
    fail "Impossible de charger la nouvelle image !"
    echo ""
    echo "  Tentative de rollback automatique..."
    if docker image inspect "$IMAGE_PREVIOUS" &>/dev/null; then
        docker tag "$IMAGE_PREVIOUS" "$IMAGE_NAME" 2>/dev/null
        docker run -d --name "$CONTAINER_NAME" \
            -p "${CONTAINER_PORT}:3000" \
            -v "${CONTAINER_VOLUME}:/data" \
            --restart unless-stopped \
            "$IMAGE_NAME" >/dev/null 2>&1
        echo "  ⚠ Rollback effectué — l'ancienne version est relancée."
    fi
    abort "Le fichier image est peut-être corrompu. Re-transférez le package."
fi

ok "Nouvelle image chargée avec succès"
echo ""

# ═══════════════════════════════════════════════════════════════
#  Étape 6/6 — Lancement du nouveau container
# ═══════════════════════════════════════════════════════════════

echo "Étape 6/6 — Lancement du nouveau container..."

# Extraire les variables d'env personnalisées (ignorer celles par défaut du Dockerfile)
ENV_ARGS=""
while IFS= read -r line; do
    case "$line" in
        JWT_SECRET=*|CORS_ORIGIN=*|ALLOWED_ORIGINS=*|JWT_EXPIRES_IN=*|SWAGGER_ENABLED=*)
            # Ne pas reprendre la valeur par défaut du Dockerfile
            VALUE="${line#*=}"
            KEY="${line%%=*}"
            if [ -n "$VALUE" ] && [ "$VALUE" != "change-me-in-production-minimum-32-characters" ]; then
                ENV_ARGS="$ENV_ARGS -e $KEY=$VALUE"
            fi
            ;;
    esac
done <<< "$CONTAINER_ENV"

docker run -d --name "$CONTAINER_NAME" \
    -p "${CONTAINER_PORT}:3000" \
    -v "${CONTAINER_VOLUME}:/data" \
    --restart unless-stopped \
    $ENV_ARGS \
    "$IMAGE_NAME" >/dev/null 2>&1 \
    || abort "Impossible de lancer le nouveau container.
  Lancez 'bash rollback.sh' pour revenir à la version précédente."

ok "Container lancé"

# Attente du health check
echo "  Vérification du démarrage (les migrations s'exécutent, patientez)..."

ELAPSED=0
while [ $ELAPSED -lt $HEALTH_TIMEOUT ]; do
    if docker exec "$CONTAINER_NAME" /healthcheck.sh &>/dev/null; then
        break
    fi

    # Vérifier que le container tourne toujours
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo ""
        fail "Le container s'est arrêté de façon inattendue."
        echo "  Consultez les logs : docker logs $CONTAINER_NAME"
        echo "  Puis lancez : bash rollback.sh"
        exit 1
    fi

    sleep $HEALTH_INTERVAL
    ELAPSED=$((ELAPSED + HEALTH_INTERVAL))
    echo "  ... en attente ($ELAPSED/${HEALTH_TIMEOUT}s)"
done

echo ""

if [ $ELAPSED -ge $HEALTH_TIMEOUT ]; then
    warn "Le health check n'a pas répondu dans le temps imparti (${HEALTH_TIMEOUT}s)."
    echo "  L'application est peut-être encore en train de démarrer."
    echo "  Vérifiez les logs : docker logs $CONTAINER_NAME"
    echo "  Puis testez : bash verify.sh"
    echo ""
    echo "  Si le problème persiste, lancez : bash rollback.sh"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════
#  Résultat
# ═══════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  ✓  MISE À JOUR TERMINÉE AVEC SUCCÈS !"
echo ""
echo "  L'application est accessible sur :"
echo "  → http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):${CONTAINER_PORT}"
echo ""
echo "  Backup de sécurité : $BACKUP_FILE"
echo ""
echo "  En cas de problème : bash rollback.sh"
echo "  Vérification :       bash verify.sh"
echo ""
echo "═══════════════════════════════════════════════════════════"
