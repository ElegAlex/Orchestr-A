#!/bin/bash
# ============================================================================
# Orchestr-A - Installation hors-ligne (sans acces internet)
# ============================================================================
# Usage: ./install.sh (depuis le dossier du package decompresse)
# ============================================================================

set -euo pipefail

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Repertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}"
echo "=================================================================="
echo "                    ORCHESTR'A"
echo "            Installation hors-ligne"
echo "=================================================================="
echo -e "${NC}"

# [1/5] Verification des prerequis
echo -e "${YELLOW}[1/5] Verification des prerequis...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}[X] Docker n'est pas installe. Installez Docker et reessayez.${NC}"
    echo "    -> https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}[X] Docker Compose v2 n'est pas installe.${NC}"
    echo "    Docker Compose v2 est inclus dans Docker Desktop ou installable via:"
    echo "    -> https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}[OK] Docker et Docker Compose v2 detectes${NC}"

# [2/5] Verification de l'image
echo -e "${YELLOW}[2/5] Verification du package...${NC}"

if [ ! -f "${SCRIPT_DIR}/images/orchestr-a.tar" ]; then
    echo -e "${RED}[X] L'image images/orchestr-a.tar est introuvable.${NC}"
    echo "    Assurez-vous d'avoir decompresse le package complet."
    exit 1
fi

echo -e "${GREEN}[OK] Image trouvee${NC}"

# [3/5] Chargement de l'image Docker
echo -e "${YELLOW}[3/5] Chargement de l'image Docker (peut prendre quelques minutes)...${NC}"

docker load -i "${SCRIPT_DIR}/images/orchestr-a.tar"

echo -e "${GREEN}[OK] Image chargee${NC}"

# [4/5] Generation des secrets et configuration
echo -e "${YELLOW}[4/5] Generation des secrets securises...${NC}"

generate_password() {
    if command -v openssl &> /dev/null; then
        openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$1"
    else
        tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c "$1"
    fi
}

POSTGRES_PASSWORD=$(generate_password 32)
REDIS_PASSWORD=$(generate_password 32)
JWT_SECRET=$(generate_password 64)

cat > "${SCRIPT_DIR}/.env" << EOF
# ============================================================================
# Orchestr-A - Configuration (hors-ligne)
# Genere le $(date -Iseconds)
# ============================================================================

# === Secrets ===
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# === Ports (optionnel) ===
HTTP_PORT=80
EOF

echo -e "${GREEN}[OK] Configuration generee (.env)${NC}"

# [5/5] Demarrage du service
echo -e "${YELLOW}[5/5] Demarrage du service...${NC}"
cd "${SCRIPT_DIR}"
docker compose -f docker-compose.yml up -d

# Attente du demarrage
echo -e "${YELLOW}    Attente du demarrage (peut prendre 60-90s)...${NC}"
echo ""

MAX_ATTEMPTS=45
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if wget --no-verbose --tries=1 --spider http://localhost/api/health 2>/dev/null; then
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo -ne "\r    Tentative $ATTEMPT/$MAX_ATTEMPTS..."
    sleep 2
done
echo ""

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${YELLOW}[!] Le service met du temps a demarrer. Verifiez les logs :${NC}"
    echo "    docker compose logs -f"
else
    echo -e "${GREEN}[OK] Service demarre${NC}"
fi

# Resume
echo ""
echo -e "${GREEN}"
echo "=================================================================="
echo "           INSTALLATION TERMINEE (hors-ligne)"
echo "=================================================================="
echo ""
echo "  Application : http://localhost"
echo "  API         : http://localhost/api"
echo "  Health      : http://localhost/api/health"
echo ""
echo "  Login       : admin"
echo "  Password    : admin123"
echo ""
echo -e "${YELLOW}  /!\\ IMPORTANT : Changez le mot de passe admin des la premiere"
echo -e "      connexion pour securiser votre installation.${NC}"
echo ""
echo -e "${GREEN}=================================================================="
echo "  Commandes utiles :"
echo "  - Logs     : docker compose logs -f"
echo "  - Stop     : docker compose down"
echo "  - Restart  : docker compose restart"
echo "=================================================================="
echo -e "${NC}"
