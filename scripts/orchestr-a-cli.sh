#!/bin/bash
#
# CLI d'administration ORCHESTR'A V2
# Usage: ./scripts/orchestr-a-cli.sh <commande>
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Fonction d'aide
show_help() {
    cat << EOF
${BLUE}╔═══════════════════════════════════════════════════════════════╗
║           ORCHESTR'A V2 - CLI d'Administration                ║
╚═══════════════════════════════════════════════════════════════╝${NC}

${GREEN}GESTION DES SERVICES${NC}
  start               Démarrer tous les services
  stop                Arrêter tous les services
  restart             Redémarrer tous les services
  status              Afficher l'état des services
  logs                Afficher les logs en temps réel

${GREEN}MONITORING${NC}
  health              Vérifier la santé de l'application
  stats               Afficher les statistiques des ressources
  ps                  Lister les conteneurs en cours

${GREEN}SAUVEGARDES${NC}
  backup              Créer une sauvegarde de la base
  restore <file>      Restaurer une sauvegarde
  list-backups        Lister les sauvegardes disponibles

${GREEN}MAINTENANCE${NC}
  update              Mettre à jour l'application
  clean               Nettoyer Docker (images inutilisées)
  rebuild             Reconstruire les images
  reset-password      Réinitialiser le mot de passe admin

${GREEN}BASE DE DONNÉES${NC}
  db-console          Ouvrir la console PostgreSQL
  db-studio           Ouvrir Prisma Studio
  db-migrate          Exécuter les migrations
  db-seed             Peupler la base avec des données de test

${GREEN}INFORMATIONS${NC}
  info                Afficher les informations de déploiement
  urls                Afficher les URLs d'accès
  version             Afficher la version

${GREEN}EXEMPLES${NC}
  ./scripts/orchestr-a-cli.sh start
  ./scripts/orchestr-a-cli.sh backup
  ./scripts/orchestr-a-cli.sh health
  ./scripts/orchestr-a-cli.sh restore backups/orchestr-a-backup-20251120_113414.sql.gz

EOF
}

# Fonction de démarrage
cmd_start() {
    echo -e "${BLUE}🚀 Démarrage d'ORCHESTR'A V2...${NC}"
    cd "$PROJECT_DIR"
    docker compose --env-file .env.production -f docker-compose.prod.yml up -d
    echo -e "${GREEN}✅ Services démarrés avec succès${NC}"
    echo ""
    echo -e "${YELLOW}⏳ Attente du démarrage complet (30 secondes)...${NC}"
    sleep 30
    cmd_health
}

# Fonction d'arrêt
cmd_stop() {
    echo -e "${BLUE}🛑 Arrêt d'ORCHESTR'A V2...${NC}"
    cd "$PROJECT_DIR"
    docker compose -f docker-compose.prod.yml down
    echo -e "${GREEN}✅ Services arrêtés avec succès${NC}"
}

# Fonction de redémarrage
cmd_restart() {
    echo -e "${BLUE}🔄 Redémarrage d'ORCHESTR'A V2...${NC}"
    cd "$PROJECT_DIR"
    docker compose -f docker-compose.prod.yml restart
    echo -e "${GREEN}✅ Services redémarrés avec succès${NC}"
}

# Fonction de statut
cmd_status() {
    echo -e "${BLUE}📊 État des services ORCHESTR'A V2${NC}"
    echo ""
    docker ps --filter "name=orchestr-a" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Fonction de logs
cmd_logs() {
    echo -e "${BLUE}📋 Logs en temps réel (Ctrl+C pour quitter)${NC}"
    cd "$PROJECT_DIR"
    docker compose -f docker-compose.prod.yml logs -f
}

# Fonction de health check
cmd_health() {
    cd "$PROJECT_DIR"
    ./scripts/health-check.sh
}

# Fonction de statistiques
cmd_stats() {
    echo -e "${BLUE}📊 Statistiques des ressources${NC}"
    echo ""
    docker stats --no-stream --filter "name=orchestr-a"
}

# Fonction de backup
cmd_backup() {
    cd "$PROJECT_DIR"
    ./scripts/backup-database.sh
}

# Fonction de restore
cmd_restore() {
    if [ -z "$1" ]; then
        echo -e "${RED}❌ Erreur: Veuillez spécifier le fichier de sauvegarde${NC}"
        echo "Usage: $0 restore <backup_file>"
        exit 1
    fi
    cd "$PROJECT_DIR"
    ./scripts/restore-database.sh "$1"
}

# Fonction pour lister les backups
cmd_list_backups() {
    echo -e "${BLUE}📁 Sauvegardes disponibles${NC}"
    echo ""
    ls -lh "$PROJECT_DIR/backups/"*.sql.gz 2>/dev/null || echo "Aucune sauvegarde trouvée"
}

# Fonction de mise à jour
cmd_update() {
    echo -e "${BLUE}🔄 Mise à jour d'ORCHESTR'A V2${NC}"
    echo ""

    # Sauvegarde
    echo -e "${YELLOW}1. Création d'une sauvegarde de sécurité...${NC}"
    cmd_backup

    # Pull
    echo ""
    echo -e "${YELLOW}2. Récupération des dernières modifications...${NC}"
    cd "$PROJECT_DIR"
    git pull origin master

    # Rebuild
    echo ""
    echo -e "${YELLOW}3. Reconstruction des images...${NC}"
    docker compose -f docker-compose.prod.yml build api web

    # Migrations
    echo ""
    echo -e "${YELLOW}4. Application des migrations...${NC}"
    docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:migrate:deploy"

    # Redémarrage
    echo ""
    echo -e "${YELLOW}5. Redémarrage des services...${NC}"
    docker compose -f docker-compose.prod.yml up -d

    echo ""
    echo -e "${GREEN}✅ Mise à jour terminée avec succès${NC}"

    # Health check
    echo ""
    sleep 10
    cmd_health
}

# Fonction de nettoyage
cmd_clean() {
    echo -e "${BLUE}🧹 Nettoyage Docker${NC}"
    echo ""
    echo -e "${YELLOW}Images Docker inutilisées...${NC}"
    docker image prune -f
    echo ""
    echo -e "${GREEN}✅ Nettoyage terminé${NC}"
}

# Fonction de rebuild
cmd_rebuild() {
    echo -e "${BLUE}🔨 Reconstruction des images${NC}"
    cd "$PROJECT_DIR"
    docker compose -f docker-compose.prod.yml build --no-cache
    echo -e "${GREEN}✅ Images reconstruites${NC}"
}

# Fonction de reset password
cmd_reset_password() {
    echo -e "${BLUE}🔐 Réinitialisation du mot de passe admin${NC}"
    docker exec orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod -c "UPDATE users SET \"passwordHash\" = '\$2b\$12\$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG' WHERE login = 'admin';"
    echo -e "${GREEN}✅ Mot de passe réinitialisé${NC}"
    echo ""
    echo -e "${YELLOW}Login: admin${NC}"
    echo -e "${YELLOW}Mot de passe: admin123${NC}"
}

# Fonction console DB
cmd_db_console() {
    echo -e "${BLUE}💾 Console PostgreSQL (\\q pour quitter)${NC}"
    docker exec -it orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod
}

# Fonction Prisma Studio
cmd_db_studio() {
    echo -e "${BLUE}📊 Démarrage de Prisma Studio...${NC}"
    echo -e "${YELLOW}Accès: http://localhost:5555${NC}"
    cd "$PROJECT_DIR"
    docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:studio"
}

# Fonction migrations
cmd_db_migrate() {
    echo -e "${BLUE}📦 Exécution des migrations${NC}"
    cd "$PROJECT_DIR"
    docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:migrate:deploy"
    echo -e "${GREEN}✅ Migrations appliquées${NC}"
}

# Fonction seed
cmd_db_seed() {
    echo -e "${BLUE}🌱 Peuplement de la base de données${NC}"
    cd "$PROJECT_DIR"
    docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:seed"
    echo -e "${GREEN}✅ Base de données peuplée${NC}"
}

# Fonction info
cmd_info() {
    cat << EOF
${BLUE}╔═══════════════════════════════════════════════════════════════╗
║              ORCHESTR'A V2 - Informations                     ║
╚═══════════════════════════════════════════════════════════════╝${NC}

${GREEN}Version${NC}          : 2.0.0
${GREEN}Environnement${NC}    : Production
${GREEN}Date déploiement${NC} : 20 novembre 2025

${GREEN}Services${NC}         : 5 (PostgreSQL, Redis, API, Frontend, Nginx)
${GREEN}Base de données${NC}  : PostgreSQL 18
${GREEN}Cache${NC}            : Redis 7.4
${GREEN}Backend${NC}          : NestJS 11.1 + Fastify 5
${GREEN}Frontend${NC}         : Next.js 16.0.1 + React 19.1

EOF
    cmd_urls
}

# Fonction URLs
cmd_urls() {
    cat << EOF
${GREEN}URLS D'ACCÈS${NC}
───────────────────────────────────────────────────────────────
Frontend (Nginx)   : ${BLUE}http://localhost${NC}
Frontend (Direct)  : ${BLUE}http://localhost:3000${NC}
API                : ${BLUE}http://localhost:3001/api${NC}
Health Check       : ${BLUE}http://localhost:3001/api/health${NC}

${GREEN}IDENTIFIANTS${NC}
───────────────────────────────────────────────────────────────
Login              : ${YELLOW}admin${NC}
Mot de passe       : ${YELLOW}admin123${NC}

EOF
}

# Fonction version
cmd_version() {
    echo "ORCHESTR'A V2 - Version 2.0.0"
}

# Main
case "${1:-}" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    status|ps)
        cmd_status
        ;;
    logs)
        cmd_logs
        ;;
    health)
        cmd_health
        ;;
    stats)
        cmd_stats
        ;;
    backup)
        cmd_backup
        ;;
    restore)
        cmd_restore "$2"
        ;;
    list-backups)
        cmd_list_backups
        ;;
    update)
        cmd_update
        ;;
    clean)
        cmd_clean
        ;;
    rebuild)
        cmd_rebuild
        ;;
    reset-password)
        cmd_reset_password
        ;;
    db-console)
        cmd_db_console
        ;;
    db-studio)
        cmd_db_studio
        ;;
    db-migrate)
        cmd_db_migrate
        ;;
    db-seed)
        cmd_db_seed
        ;;
    info)
        cmd_info
        ;;
    urls)
        cmd_urls
        ;;
    version)
        cmd_version
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        echo -e "${RED}❌ Commande inconnue: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
