#!/bin/bash

# ========================================
# Script de déploiement production ORCHESTR'A V2
# ========================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
cat << "EOF"
   ____  ____   _____ _    _ ______  _____ _______ _____         __      _____
  / __ \|  _ \ / ____| |  | |  ____|/ ____|__   __|  __ \       /\ \    / /__ \
 | |  | | |_) | |    | |__| | |__  | (___    | |  | |__) |     /  \ \  / /   ) |
 | |  | |  _ <| |    |  __  |  __|  \___ \   | |  |  _  /     / /\ \ \/ /   / /
 | |__| | |_) | |____| |  | | |____ ____) |  | |  | | \ \    / ____ \  /   / /_
  \____/|____/ \_____|_|  |_|______|_____/   |_|  |_|  \_\  /_/    \_\/   |____|

EOF
echo -e "${NC}"
echo "🚀 Déploiement en Production"
echo "================================================"
echo ""

# Fonctions utilitaires
step() {
  echo -e "${BLUE}▶ $1${NC}"
}

success() {
  echo -e "${GREEN}✓ $1${NC}"
}

error() {
  echo -e "${RED}✗ $1${NC}"
  exit 1
}

warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Vérification des prérequis
step "Vérification des prérequis..."

if ! command -v docker &> /dev/null; then
  error "Docker n'est pas installé"
fi

if ! command -v docker-compose &> /dev/null; then
  error "Docker Compose n'est pas installé"
fi

if ! command -v git &> /dev/null; then
  error "Git n'est pas installé"
fi

success "Tous les prérequis sont installés"
echo ""

# Vérification du fichier .env.production
step "Vérification de la configuration..."

if [ ! -f ".env.production" ]; then
  error "Le fichier .env.production n'existe pas. Copiez .env.production.example et configurez-le."
fi

# Vérification des variables critiques
source .env.production

if [ -z "$DATABASE_URL" ]; then
  error "DATABASE_URL n'est pas défini dans .env.production"
fi

if [ -z "$JWT_SECRET" ]; then
  error "JWT_SECRET n'est pas défini dans .env.production"
fi

if [ "$JWT_SECRET" == "CHANGE_THIS_TO_A_SECURE_RANDOM_STRING" ]; then
  error "JWT_SECRET utilise la valeur par défaut. Générez un secret fort avec: openssl rand -base64 64"
fi

success "Configuration validée"
echo ""

# Confirmation de l'utilisateur
echo -e "${YELLOW}⚠️  ATTENTION : Vous êtes sur le point de déployer en PRODUCTION${NC}"
echo ""
echo "Détails du déploiement :"
echo "  - Branch actuelle : $(git branch --show-current)"
echo "  - Dernier commit : $(git log -1 --oneline)"
echo "  - Date : $(date)"
echo ""
read -p "Voulez-vous continuer ? (yes/NO) " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "Déploiement annulé."
  exit 0
fi

# Backup de la base de données
step "Création d'un backup de la base de données..."

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/orchestr-a-backup-$(date +%Y%m%d-%H%M%S).sql"

if docker-compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
  docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U orchestr_a orchestr_a_v2 > "$BACKUP_FILE" || warning "Backup a échoué (non bloquant)"
  if [ -f "$BACKUP_FILE" ]; then
    success "Backup créé : $BACKUP_FILE"
  fi
else
  warning "PostgreSQL n'est pas démarré, backup ignoré"
fi
echo ""

# Pull des dernières modifications
step "Récupération des dernières modifications..."
git fetch origin
git pull origin master || error "Échec du pull Git"
success "Code mis à jour"
echo ""

# Arrêt des services actuels
step "Arrêt des services actuels..."
docker-compose -f docker-compose.prod.yml down || warning "Aucun service à arrêter"
success "Services arrêtés"
echo ""

# Build des nouvelles images
step "Build des images Docker..."
docker-compose --env-file .env.production -f docker-compose.prod.yml build --no-cache || error "Échec du build Docker"
success "Images Docker construites"
echo ""

# Démarrage des services
step "Démarrage des services..."
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d || error "Échec du démarrage des services"
success "Services démarrés"
echo ""

# Attente que PostgreSQL soit prêt
step "Attente de PostgreSQL..."
for i in {1..30}; do
  if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U orchestr_a > /dev/null 2>&1; then
    success "PostgreSQL prêt"
    break
  fi
  if [ $i -eq 30 ]; then
    error "PostgreSQL n'a pas démarré après 60 secondes"
  fi
  sleep 2
done
echo ""

# Exécution des migrations
step "Exécution des migrations de base de données..."
docker-compose -f docker-compose.prod.yml exec -T api sh -c "cd packages/database && npx prisma migrate deploy" || error "Échec des migrations"
success "Migrations appliquées"
echo ""

# Attente que l'API soit prête
step "Attente du démarrage de l'API..."
for i in {1..60}; do
  if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    success "API prête"
    break
  fi
  if [ $i -eq 60 ]; then
    error "L'API n'a pas démarré après 120 secondes"
  fi
  sleep 2
done
echo ""

# Attente que le frontend soit prêt
step "Attente du démarrage du frontend..."
for i in {1..60}; do
  if curl -f http://localhost:3000 > /dev/null 2>&1; then
    success "Frontend prêt"
    break
  fi
  if [ $i -eq 60 ]; then
    error "Le frontend n'a pas démarré après 120 secondes"
  fi
  sleep 2
done
echo ""

# Health checks finaux
step "Vérifications finales..."

# Check API Health
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
  success "✓ API Health OK"
else
  error "✗ API Health FAILED"
fi

# Check Frontend
if curl -I http://localhost:3000 2>&1 | grep -q "200\|301\|302"; then
  success "✓ Frontend OK"
else
  error "✗ Frontend FAILED"
fi

# Check PostgreSQL
if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U orchestr_a > /dev/null 2>&1; then
  success "✓ PostgreSQL OK"
else
  error "✗ PostgreSQL FAILED"
fi

# Check Redis
if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping 2>&1 | grep -q "PONG"; then
  success "✓ Redis OK"
else
  warning "✗ Redis FAILED (non critique)"
fi

echo ""

# Status des conteneurs
step "Status des conteneurs..."
docker-compose -f docker-compose.prod.yml ps
echo ""

# Résumé final
echo "================================================"
echo -e "${GREEN}✅ Déploiement réussi !${NC}"
echo "================================================"
echo ""
echo "📊 Informations :"
echo "  - Commit déployé : $(git log -1 --oneline)"
echo "  - Backup DB : $BACKUP_FILE"
echo "  - Date : $(date)"
echo ""
echo "🌐 URLs d'accès :"
echo "  - Frontend : http://localhost:3000"
echo "  - API : http://localhost:3001"
echo "  - Swagger : http://localhost:3001/api/docs"
echo ""
echo "📝 Commandes utiles :"
echo "  - Logs : docker-compose -f docker-compose.prod.yml logs -f"
echo "  - Status : docker-compose -f docker-compose.prod.yml ps"
echo "  - Arrêt : docker-compose -f docker-compose.prod.yml down"
echo ""
echo "🔄 En cas de problème :"
echo "  - Rollback : git checkout <commit-précédent> && ./scripts/deploy-production.sh"
echo "  - Restaurer DB : docker-compose -f docker-compose.prod.yml exec -T postgres psql -U orchestr_a orchestr_a_v2 < $BACKUP_FILE"
echo ""
success "Déploiement terminé avec succès !"
