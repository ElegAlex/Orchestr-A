#!/bin/bash
#
# Script de vérification de la santé de l'application
# Usage: ./scripts/health-check.sh
#

set -e

echo "🏥 Vérification de la santé de l'application ORCHESTR'A V2"
echo "============================================================"
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Fonction pour vérifier un service
check_service() {
    SERVICE_NAME=$1
    CONTAINER_NAME=$2

    echo -n "🔍 ${SERVICE_NAME}... "

    if docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" | grep -q "${CONTAINER_NAME}"; then
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "unknown")
        if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "unknown" ]; then
            echo -e "${GREEN}✅ OK${NC}"
        else
            echo -e "${RED}❌ UNHEALTHY${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo -e "${RED}❌ NON DÉMARRÉ${NC}"
        ERRORS=$((ERRORS + 1))
    fi
}

# Vérifier les conteneurs
echo "📦 Vérification des conteneurs Docker:"
echo ""
check_service "PostgreSQL" "orchestr-a-postgres-prod"
check_service "Redis" "orchestr-a-redis-prod"
check_service "API Backend" "orchestr-a-api-prod"
check_service "Frontend Web" "orchestr-a-web-prod"
check_service "Nginx Reverse Proxy" "orchestr-a-nginx-prod"

echo ""
echo "🌐 Vérification des endpoints HTTP:"
echo ""

# Vérifier API Health
echo -n "🔍 API Health Check (http://localhost:3001/api/health)... "
if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ ÉCHEC${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Vérifier Frontend via Nginx
echo -n "🔍 Frontend via Nginx (http://localhost)... "
if curl -s -f http://localhost > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ ÉCHEC${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Vérifier Frontend direct
echo -n "🔍 Frontend direct (http://localhost:3000)... "
if curl -s -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ ÉCHEC${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "💾 Vérification de la base de données:"
echo ""

# Vérifier la connexion PostgreSQL
echo -n "🔍 Connexion PostgreSQL... "
if docker exec orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"

    # Compter les utilisateurs
    USER_COUNT=$(docker exec orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs)
    echo "   👥 Utilisateurs en base: ${USER_COUNT}"

    # Compter les projets
    PROJECT_COUNT=$(docker exec orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod -t -c "SELECT COUNT(*) FROM projects;" 2>/dev/null | xargs)
    echo "   📋 Projets en base: ${PROJECT_COUNT}"

    # Compter les tâches
    TASK_COUNT=$(docker exec orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod -t -c "SELECT COUNT(*) FROM tasks;" 2>/dev/null | xargs)
    echo "   ✅ Tâches en base: ${TASK_COUNT}"
else
    echo -e "${RED}❌ ÉCHEC${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "📊 Utilisation des ressources:"
echo ""

# Utilisation disque
echo "💾 Espace disque:"
docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}\t{{.Reclaimable}}"

echo ""
echo "🔢 Résumé des conteneurs:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo ""
echo "============================================================"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 Tous les services fonctionnent correctement!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  ${ERRORS} erreur(s) détectée(s)${NC}"
    exit 1
fi
