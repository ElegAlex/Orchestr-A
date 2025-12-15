#!/bin/bash

###############################################################################
# ORCHESTR'A - Script de Déploiement Production
# Version: 2.0
# Description: Script automatisé de déploiement en production
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="orchestr-a"
ENV_FILE="${SCRIPT_DIR}/.env.production"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"
BACKUP_DIR="${SCRIPT_DIR}/backups"

###############################################################################
# Fonctions utilitaires
###############################################################################

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "La commande '$1' n'est pas installée. Veuillez l'installer avant de continuer."
        exit 1
    fi
}

###############################################################################
# Vérifications préalables
###############################################################################

log_info "=== Démarrage du déploiement ORCHESTR'A en production ==="
echo ""

log_info "Vérification des prérequis..."
check_command "docker"
check_command "docker-compose"
check_command "git"
check_command "pnpm"
log_success "Tous les prérequis sont installés"
echo ""

# Vérifier le fichier .env.production
if [ ! -f "$ENV_FILE" ]; then
    log_error "Le fichier .env.production est manquant."
    log_info "Copie du template .env.production.example vers .env.production..."

    if [ -f "${SCRIPT_DIR}/.env.production.example" ]; then
        cp "${SCRIPT_DIR}/.env.production.example" "$ENV_FILE"
        log_warning "⚠️  ATTENTION: Vous devez éditer .env.production et remplir toutes les variables !"
        log_warning "Notamment: DATABASE_PASSWORD, REDIS_PASSWORD, JWT_SECRET, CORS_ORIGIN"
        echo ""
        read -p "Appuyez sur Entrée après avoir configuré .env.production..."
    else
        log_error "Le fichier .env.production.example est également manquant."
        exit 1
    fi
fi

# Vérifier que les secrets sont bien configurés
log_info "Vérification des secrets..."
source "$ENV_FILE"

if [ "$DATABASE_PASSWORD" = "CHANGE_ME_STRONG_PASSWORD_HERE" ] || \
   [ "$REDIS_PASSWORD" = "CHANGE_ME_REDIS_PASSWORD_HERE" ] || \
   [ "$JWT_SECRET" = "CHANGE_ME_JWT_SECRET_MINIMUM_32_CHARACTERS" ]; then
    log_error "Les secrets dans .env.production n'ont pas été modifiés !"
    log_error "Veuillez configurer DATABASE_PASSWORD, REDIS_PASSWORD et JWT_SECRET"
    exit 1
fi
log_success "Configuration des secrets validée"
echo ""

###############################################################################
# Sauvegarde de la base de données existante
###############################################################################

log_info "=== Sauvegarde de la base de données (si elle existe) ==="
mkdir -p "$BACKUP_DIR"

if docker ps -a | grep -q "${PROJECT_NAME}-postgres-prod"; then
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql"

    log_info "Création de la sauvegarde: $BACKUP_FILE"
    docker exec "${PROJECT_NAME}-postgres-prod" pg_dump -U postgres orchestr_a_prod > "$BACKUP_FILE" 2>/dev/null || {
        log_warning "Impossible de sauvegarder la base (probablement première installation)"
    }

    if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
        log_success "Sauvegarde créée avec succès"

        # Garder seulement les 5 dernières sauvegardes
        cd "$BACKUP_DIR"
        ls -t db_backup_*.sql | tail -n +6 | xargs -r rm --
        log_info "Sauvegardes anciennes nettoyées (max 5 conservées)"
    fi
else
    log_info "Aucune base de données existante détectée (première installation)"
fi
echo ""

###############################################################################
# Build et déploiement
###############################################################################

log_info "=== Build de l'image Docker ==="
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build api
log_success "Image API construite avec succès"
echo ""

log_info "=== Arrêt des services existants ==="
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
log_success "Services arrêtés"
echo ""

log_info "=== Démarrage des services de base (PostgreSQL, Redis) ==="
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis
log_info "Attente du démarrage de PostgreSQL..."
sleep 15
log_success "Services de base démarrés"
echo ""

###############################################################################
# Migrations Prisma
###############################################################################

log_info "=== Exécution des migrations Prisma ==="
log_info "Génération du client Prisma..."
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm api sh -c "cd /app/packages/database && pnpm run db:generate"

log_info "Application des migrations..."
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm api sh -c "cd /app/packages/database && pnpm run db:migrate:deploy"
log_success "Migrations appliquées avec succès"
echo ""

###############################################################################
# Démarrage de l'API
###############################################################################

log_info "=== Démarrage de l'API ==="
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d api
log_info "Attente du healthcheck de l'API..."
sleep 20

# Vérifier que l'API est bien démarrée
API_PORT="${API_PORT:-4000}"
if curl -f "http://localhost:${API_PORT}/health" &>/dev/null; then
    log_success "API démarrée avec succès sur le port ${API_PORT}"
else
    log_error "L'API ne répond pas au healthcheck !"
    log_error "Vérifiez les logs: docker-compose -f $COMPOSE_FILE logs api"
    exit 1
fi
echo ""

###############################################################################
# Seed de données initiales (optionnel)
###############################################################################

read -p "Voulez-vous exécuter le seed de données initiales ? (o/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[OoYy]$ ]]; then
    log_info "=== Exécution du seed de données ==="
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm api sh -c "cd /app/packages/database && pnpm run db:seed" || {
        log_warning "Le seed a échoué ou n'est pas configuré"
    }
    log_success "Seed terminé"
    echo ""
fi

###############################################################################
# Démarrage du reverse proxy (optionnel)
###############################################################################

if [ -f "${SCRIPT_DIR}/nginx/nginx.conf" ]; then
    read -p "Voulez-vous démarrer Nginx en reverse proxy ? (o/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[OoYy]$ ]]; then
        log_info "=== Démarrage de Nginx ==="
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d nginx
        log_success "Nginx démarré"
        echo ""
    fi
else
    log_warning "Configuration Nginx non trouvée, reverse proxy non démarré"
fi

###############################################################################
# Résumé du déploiement
###############################################################################

log_success "=== ✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS ✅ ==="
echo ""
log_info "📊 Services déployés:"
docker-compose -f "$COMPOSE_FILE" ps
echo ""

log_info "🔗 URLs disponibles:"
echo "   - API: http://localhost:${API_PORT}"
echo "   - Health: http://localhost:${API_PORT}/health"
if [ "${SWAGGER_ENABLED:-false}" = "true" ]; then
    echo "   - Swagger: http://localhost:${API_PORT}/api"
fi
echo ""

log_info "📝 Commandes utiles:"
echo "   - Logs en temps réel: docker-compose -f $COMPOSE_FILE logs -f"
echo "   - Logs API uniquement: docker-compose -f $COMPOSE_FILE logs -f api"
echo "   - Redémarrer l'API: docker-compose -f $COMPOSE_FILE restart api"
echo "   - Arrêter tous les services: docker-compose -f $COMPOSE_FILE down"
echo "   - Reconstruire l'API: docker-compose -f $COMPOSE_FILE build api"
echo ""

log_info "🔐 Sécurité:"
log_warning "   - Assurez-vous que .env.production n'est PAS commité dans Git"
log_warning "   - Configurez un firewall pour limiter l'accès aux ports"
log_warning "   - Activez HTTPS avec des certificats SSL/TLS"
log_warning "   - Changez les secrets régulièrement"
echo ""

log_success "🎉 Déploiement réussi ! L'application est prête en production."
