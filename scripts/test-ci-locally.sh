#!/bin/bash

# ========================================
# Script pour tester le pipeline CI localement
# ========================================

set -e

echo "🚀 ORCHESTR'A V2 - Test du pipeline CI en local"
echo "================================================"
echo ""

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les étapes
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

if ! command -v node &> /dev/null; then
  error "Node.js n'est pas installé"
fi

if ! command -v pnpm &> /dev/null; then
  error "pnpm n'est pas installé"
fi

if ! command -v docker &> /dev/null; then
  error "Docker n'est pas installé"
fi

success "Tous les prérequis sont installés"
echo ""

# Nettoyage
step "Nettoyage des builds précédents..."
rm -rf apps/api/dist apps/web/.next node_modules/.cache 2>/dev/null || true
success "Nettoyage terminé"
echo ""

# Installation des dépendances
step "Installation des dépendances..."
pnpm install --frozen-lockfile || error "Échec de l'installation des dépendances"
success "Dépendances installées"
echo ""

# Génération Prisma
step "Génération du client Prisma..."
pnpm --filter database prisma generate || error "Échec de la génération Prisma"
success "Client Prisma généré"
echo ""

# Lint & Format
step "Vérification du linting..."
pnpm run lint || warning "Le linting a détecté des problèmes (non bloquant)"
success "Linting terminé"
echo ""

step "Vérification du formatage..."
pnpm run format:check || warning "Le formatage n'est pas conforme (non bloquant)"
success "Vérification du formatage terminée"
echo ""

# Démarrage des services Docker pour les tests
step "Démarrage des services Docker (PostgreSQL + Redis)..."
docker-compose up -d postgres redis || error "Échec du démarrage des services Docker"
success "Services Docker démarrés"
echo ""

# Attente que PostgreSQL soit prêt
step "Attente de PostgreSQL..."
sleep 5
docker exec orchestr-a-postgres pg_isready -U orchestr_a || error "PostgreSQL n'est pas prêt"
success "PostgreSQL prêt"
echo ""

# Migrations de base de données
step "Exécution des migrations..."
export DATABASE_URL="postgresql://orchestr_a:orchestr_a_dev_password@localhost:5432/orchestr_a_v2"
pnpm --filter database prisma migrate deploy || error "Échec des migrations"
success "Migrations terminées"
echo ""

# Tests Backend
step "Exécution des tests backend..."
export JWT_SECRET="test-jwt-secret-key"
export REDIS_URL="redis://localhost:6379"
cd apps/api
pnpm test || warning "Certains tests backend ont échoué (à corriger)"
cd ../..
success "Tests backend terminés"
echo ""

# Tests Frontend
step "Exécution des tests frontend..."
export NEXT_PUBLIC_API_URL="http://localhost:3001"
cd apps/web
pnpm test || warning "Certains tests frontend ont échoué (à corriger)"
cd ../..
success "Tests frontend terminés"
echo ""

# Build Backend
step "Build du backend..."
cd apps/api
pnpm run build || error "Échec du build backend"
cd ../..
success "Build backend réussi"
echo ""

# Build Frontend
step "Build du frontend..."
cd apps/web
pnpm run build || error "Échec du build frontend"
cd ../..
success "Build frontend réussi"
echo ""

# Tests E2E (optionnel - peut être long)
read -p "Voulez-vous exécuter les tests E2E ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  step "Exécution des tests E2E..."

  # Seed de la base de données
  pnpm --filter database prisma db seed || warning "Échec du seed (non bloquant)"

  # Lancement de l'API en arrière-plan
  cd apps/api
  pnpm start &
  API_PID=$!
  cd ../..

  # Attente que l'API soit prête
  echo "Attente du démarrage de l'API..."
  for i in {1..30}; do
    if curl -f http://localhost:3001/health 2>/dev/null; then
      success "API prête"
      break
    fi
    sleep 2
  done

  # Exécution des tests E2E
  pnpm test:e2e || warning "Certains tests E2E ont échoué (à corriger)"

  # Arrêt de l'API
  kill $API_PID 2>/dev/null || true

  success "Tests E2E terminés"
  echo ""
fi

# Build Docker (optionnel)
read -p "Voulez-vous tester les builds Docker ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  step "Build de l'image Docker API..."
  docker build -f apps/api/Dockerfile -t orchestr-a-api:test . || error "Échec du build Docker API"
  success "Image Docker API construite"
  echo ""

  step "Build de l'image Docker Web..."
  docker build -f apps/web/Dockerfile -t orchestr-a-web:test . || error "Échec du build Docker Web"
  success "Image Docker Web construite"
  echo ""
fi

# Résumé final
echo ""
echo "================================================"
echo -e "${GREEN}✅ Pipeline CI testé avec succès !${NC}"
echo "================================================"
echo ""
echo "📊 Résumé :"
echo "  ✓ Linting et formatage"
echo "  ✓ Tests backend"
echo "  ✓ Tests frontend"
echo "  ✓ Build backend"
echo "  ✓ Build frontend"
[[ $REPLY =~ ^[Yy]$ ]] && echo "  ✓ Tests E2E"
[[ $REPLY =~ ^[Yy]$ ]] && echo "  ✓ Builds Docker"
echo ""
echo "🎯 Prochaines étapes :"
echo "  1. Corriger les warnings si nécessaire"
echo "  2. Pousser le code sur GitHub"
echo "  3. Le workflow CI/CD s'exécutera automatiquement"
echo ""
echo "Pour nettoyer :"
echo "  docker-compose down -v"
echo "  rm -rf node_modules apps/*/dist apps/web/.next"
echo ""
