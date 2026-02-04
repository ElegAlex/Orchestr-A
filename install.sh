#!/bin/bash
# ============================================================================
# Orchestr-A - Script d'installation rapide
# ============================================================================
# Usage: curl -fsSL https://raw.githubusercontent.com/ElegAlex/Orchestr-A/master/install.sh | bash
# ============================================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=================================================================="
echo "                    ORCHESTR'A"
echo "              Installation cles en main"
echo "=================================================================="
echo -e "${NC}"

# Verification des prerequis
echo -e "${YELLOW}[1/6] Verification des prerequis...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}[X] Docker n'est pas installe. Installez Docker et reessayez.${NC}"
    echo "    -> https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}[X] Docker Compose v2 n'est pas installe.${NC}"
    exit 1
fi

echo -e "${GREEN}[OK] Docker et Docker Compose detectes${NC}"

# Creation du repertoire
INSTALL_DIR="${INSTALL_DIR:-orchestr-a}"
echo -e "${YELLOW}[2/6] Creation du repertoire ${INSTALL_DIR}...${NC}"

if [ -d "$INSTALL_DIR" ]; then
    echo -e "${RED}[X] Le repertoire ${INSTALL_DIR} existe deja.${NC}"
    echo "    Supprimez-le ou choisissez un autre nom : INSTALL_DIR=autre-nom ./install.sh"
    exit 1
fi

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo -e "${GREEN}[OK] Repertoire cree${NC}"

# Telechargement du docker-compose
echo -e "${YELLOW}[3/6] Telechargement de la configuration...${NC}"
REPO_URL="https://raw.githubusercontent.com/ElegAlex/Orchestr-A/master"
curl -fsSL "${REPO_URL}/docker-compose.standalone.yml" -o docker-compose.yml

echo -e "${GREEN}[OK] Configuration telechargee${NC}"

# Generation des secrets
echo -e "${YELLOW}[4/6] Generation des secrets securises...${NC}"

generate_password() {
    if command -v openssl &> /dev/null; then
        openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$1"
    else
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c "$1"
    fi
}

POSTGRES_PASSWORD=$(generate_password 32)
REDIS_PASSWORD=$(generate_password 32)
JWT_SECRET=$(generate_password 64)

# Creation du .env
cat > .env << EOF
# ============================================================================
# Orchestr-A - Configuration
# Genere le $(date -Iseconds)
# ============================================================================

# === Base de donnees ===
POSTGRES_USER=orchestr_a
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=orchestr_a

# === Redis ===
REDIS_PASSWORD=${REDIS_PASSWORD}

# === JWT ===
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# === URLs ===
# Modifier selon votre configuration
CORS_ORIGIN=http://localhost:3000
# Note: NEXT_PUBLIC_API_URL est compile dans l'image web, utilise /api par defaut

# === Ports (optionnel) ===
API_PORT=4000
WEB_PORT=3000

# === Version des images ===
VERSION=latest
GITHUB_OWNER=elegalex
EOF

echo -e "${GREEN}[OK] Configuration generee (.env)${NC}"

# Pull des images
echo -e "${YELLOW}[5/6] Telechargement des images Docker...${NC}"
docker compose pull

echo -e "${GREEN}[OK] Images telechargees${NC}"

# Demarrage
echo -e "${YELLOW}[6/6] Demarrage des services...${NC}"
docker compose up -d

# Attente du demarrage
echo -e "${YELLOW}    Attente du demarrage des services (peut prendre 60-90s)...${NC}"
echo ""

MAX_ATTEMPTS=45
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo -ne "\r    Tentative $ATTEMPT/$MAX_ATTEMPTS..."
    sleep 2
done
echo ""

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${YELLOW}[!] L'API met du temps a demarrer. Verifiez les logs :${NC}"
    echo "    docker compose logs -f api"
else
    echo -e "${GREEN}[OK] API demarree${NC}"
fi

# Resume
echo ""
echo -e "${GREEN}"
echo "=================================================================="
echo "           INSTALLATION TERMINEE"
echo "=================================================================="
echo ""
echo "  Application : http://localhost:3000"
echo "  API         : http://localhost:4000"
echo "  Health      : http://localhost:4000/api/health"
echo ""
echo "  Login       : admin"
echo "  Password    : admin123"
echo ""
echo "=================================================================="
echo "  Commandes utiles :"
echo "  - Logs     : docker compose logs -f"
echo "  - Stop     : docker compose down"
echo "  - Restart  : docker compose restart"
echo "  - Update   : docker compose pull && docker compose up -d"
echo "=================================================================="
echo -e "${NC}"
