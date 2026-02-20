#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  ORCHESTR'A V2 — Script de vérification
#  Usage : bash verify.sh
# ═══════════════════════════════════════════════════════════════

CONTAINER_NAME="orchestr-a"

# Couleurs
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    YELLOW='\033[0;33m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    GREEN='' RED='' YELLOW='' BOLD='' NC=''
fi

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }

ERRORS=0

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  VÉRIFICATION ORCHESTR'A V2"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─── 1. État du container ────────────────────────────────────────

echo -e "${BOLD}1. État du container${NC}"

if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    fail "Container '$CONTAINER_NAME' introuvable"
    echo "  L'application n'est pas installée ou le container a un autre nom."
    exit 1
fi

CONTAINER_STATUS=$(docker inspect "$CONTAINER_NAME" --format '{{.State.Status}}' 2>/dev/null)
CONTAINER_UPTIME=$(docker inspect "$CONTAINER_NAME" --format '{{.State.StartedAt}}' 2>/dev/null | cut -d'.' -f1 | tr 'T' ' ')

if [ "$CONTAINER_STATUS" = "running" ]; then
    ok "Container : EN COURS D'EXÉCUTION (depuis $CONTAINER_UPTIME)"
else
    fail "Container : $CONTAINER_STATUS"
    ERRORS=$((ERRORS + 1))
fi

# ─── 2. Image Docker ────────────────────────────────────────────

echo ""
echo -e "${BOLD}2. Image Docker${NC}"

IMAGE_ID=$(docker inspect "$CONTAINER_NAME" --format '{{.Image}}' 2>/dev/null | cut -c8-19)
IMAGE_NAME_FULL=$(docker inspect "$CONTAINER_NAME" --format '{{.Config.Image}}' 2>/dev/null)
IMAGE_CREATED=$(docker inspect "$IMAGE_NAME_FULL" --format '{{.Created}}' 2>/dev/null | cut -d'.' -f1 | tr 'T' ' ')

ok "Image : $IMAGE_NAME_FULL"
ok "ID : $IMAGE_ID"
ok "Créée le : $IMAGE_CREATED"

# Vérifier si une image "previous" existe
if docker image inspect "ghcr.io/elegalex/orchestr-a:previous" &>/dev/null; then
    ok "Image rollback : disponible"
else
    warn "Image rollback : non disponible"
fi

# ─── 3. Services internes ────────────────────────────────────────

echo ""
echo -e "${BOLD}3. Services internes${NC}"

if [ "$CONTAINER_STATUS" = "running" ]; then
    SERVICES=$(docker exec "$CONTAINER_NAME" supervisorctl status 2>/dev/null)
    if [ -n "$SERVICES" ]; then
        while IFS= read -r line; do
            SERVICE_NAME=$(echo "$line" | awk '{print $1}')
            SERVICE_STATUS=$(echo "$line" | awk '{print $2}')
            if [ "$SERVICE_STATUS" = "RUNNING" ]; then
                ok "$SERVICE_NAME : EN COURS"
            else
                fail "$SERVICE_NAME : $SERVICE_STATUS"
                ERRORS=$((ERRORS + 1))
            fi
        done <<< "$SERVICES"
    else
        warn "Impossible de lire l'état des services"
    fi
else
    fail "Container arrêté — impossible de vérifier les services"
    ERRORS=$((ERRORS + 1))
fi

# ─── 4. Health check API ─────────────────────────────────────────

echo ""
echo -e "${BOLD}4. Health check API${NC}"

if [ "$CONTAINER_STATUS" = "running" ]; then
    HEALTH_RESULT=$(docker exec "$CONTAINER_NAME" curl -sf http://localhost:3000/api/health 2>/dev/null)
    if [ $? -eq 0 ]; then
        ok "API : répond correctement"
        if [ -n "$HEALTH_RESULT" ]; then
            echo "  Réponse : $HEALTH_RESULT"
        fi
    else
        fail "API : ne répond pas au health check"
        ERRORS=$((ERRORS + 1))
    fi
else
    fail "Container arrêté — impossible de tester l'API"
    ERRORS=$((ERRORS + 1))
fi

# ─── 5. Dernière migration ───────────────────────────────────────

echo ""
echo -e "${BOLD}5. Migrations Prisma${NC}"

if [ "$CONTAINER_STATUS" = "running" ]; then
    LAST_MIGRATION=$(docker exec "$CONTAINER_NAME" gosu postgres psql -d orchestr_a -tAc \
        "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1;" 2>/dev/null)
    TOTAL_MIGRATIONS=$(docker exec "$CONTAINER_NAME" gosu postgres psql -d orchestr_a -tAc \
        "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;" 2>/dev/null)

    if [ -n "$LAST_MIGRATION" ]; then
        ok "Dernière migration : $LAST_MIGRATION"
        ok "Total migrations appliquées : $TOTAL_MIGRATIONS"
    else
        warn "Impossible de lire les migrations"
    fi
fi

# ─── 6. Données en base ─────────────────────────────────────────

echo ""
echo -e "${BOLD}6. Données en base${NC}"

if [ "$CONTAINER_STATUS" = "running" ]; then
    USER_COUNT=$(docker exec "$CONTAINER_NAME" gosu postgres psql -d orchestr_a -tAc "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "?")
    PROJECT_COUNT=$(docker exec "$CONTAINER_NAME" gosu postgres psql -d orchestr_a -tAc "SELECT COUNT(*) FROM projects;" 2>/dev/null || echo "?")
    TASK_COUNT=$(docker exec "$CONTAINER_NAME" gosu postgres psql -d orchestr_a -tAc "SELECT COUNT(*) FROM tasks;" 2>/dev/null || echo "?")

    ok "Utilisateurs : $USER_COUNT"
    ok "Projets :      $PROJECT_COUNT"
    ok "Tâches :       $TASK_COUNT"
fi

# ─── 7. Espace disque ───────────────────────────────────────────

echo ""
echo -e "${BOLD}7. Espace disque${NC}"

VOLUME_NAME=$(docker inspect "$CONTAINER_NAME" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' 2>/dev/null)
if [ -n "$VOLUME_NAME" ]; then
    VOLUME_SIZE=$(docker system df -v 2>/dev/null | grep "$VOLUME_NAME" | awk '{print $3}' || echo "?")
    ok "Volume : $VOLUME_NAME"
    ok "Taille : ${VOLUME_SIZE:-non disponible}"
else
    warn "Volume non trouvé"
fi

IMAGE_SIZE=$(docker image inspect "$IMAGE_NAME_FULL" --format '{{.Size}}' 2>/dev/null)
if [ -n "$IMAGE_SIZE" ]; then
    IMAGE_SIZE_MB=$((IMAGE_SIZE / 1024 / 1024))
    ok "Image : ${IMAGE_SIZE_MB} Mo"
fi

# ─── Résumé ──────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
    echo -e "  ${GREEN}✓  TOUT EST OK${NC}"
else
    echo -e "  ${RED}✗  $ERRORS PROBLÈME(S) DÉTECTÉ(S)${NC}"
    echo "  Consultez les détails ci-dessus."
    echo "  Logs : docker logs $CONTAINER_NAME"
fi
echo "═══════════════════════════════════════════════════════════"
echo ""

exit $ERRORS
