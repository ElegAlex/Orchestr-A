#!/bin/bash

###############################################################################
# ORCHESTR'A - Script de Verification Pre-Deploiement
# Version: 1.0
# Description: Verifie que l'environnement est correctement configure avant deploiement
###############################################################################

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ERRORS=0
WARNINGS=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}[ERREUR]${NC} $1"
    ((ERRORS++))
}

separator() {
    echo ""
    echo "============================================================"
    echo "$1"
    echo "============================================================"
}

###############################################################################
# 1. Verification des prerequis systeme
###############################################################################

separator "1. VERIFICATION DES PREREQUIS SYSTEME"

# Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 22 ]; then
        log_success "Node.js v$NODE_VERSION (>= 22 requis)"
    else
        log_error "Node.js v$NODE_VERSION insuffisant (>= 22 requis)"
    fi
else
    log_error "Node.js non installe"
fi

# pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    PNPM_MAJOR=$(echo "$PNPM_VERSION" | cut -d'.' -f1)
    if [ "$PNPM_MAJOR" -ge 9 ]; then
        log_success "pnpm v$PNPM_VERSION (>= 9 requis)"
    else
        log_error "pnpm v$PNPM_VERSION insuffisant (>= 9 requis)"
    fi
else
    log_error "pnpm non installe"
fi

# Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    log_success "Docker v$DOCKER_VERSION"
else
    log_error "Docker non installe"
fi

# Docker Compose
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "v2+")
        log_success "Docker Compose $COMPOSE_VERSION (plugin)"
    else
        COMPOSE_VERSION=$(docker-compose --version | grep -oP '\d+\.\d+\.\d+' | head -1)
        log_success "Docker Compose v$COMPOSE_VERSION (standalone)"
    fi
else
    log_error "Docker Compose non installe"
fi

###############################################################################
# 2. Verification des fichiers de configuration
###############################################################################

separator "2. VERIFICATION DES FICHIERS DE CONFIGURATION"

# .env ou .env.production
if [ -f "$PROJECT_ROOT/.env" ]; then
    log_success "Fichier .env present"
    ENV_FILE="$PROJECT_ROOT/.env"
elif [ -f "$PROJECT_ROOT/.env.production" ]; then
    log_success "Fichier .env.production present"
    ENV_FILE="$PROJECT_ROOT/.env.production"
else
    log_error "Aucun fichier .env ou .env.production trouve"
    ENV_FILE=""
fi

# Verification des variables d'environnement critiques
if [ -n "$ENV_FILE" ]; then
    echo ""
    log_info "Verification des variables d'environnement critiques..."

    # DATABASE_URL
    if grep -q "^DATABASE_URL=" "$ENV_FILE"; then
        DB_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d'=' -f2-)
        if [[ "$DB_URL" == *"CHANGE_ME"* ]] || [[ "$DB_URL" == *"your_"* ]]; then
            log_warning "DATABASE_URL contient une valeur par defaut non modifiee"
        else
            log_success "DATABASE_URL definie"
        fi
    else
        log_error "DATABASE_URL non definie"
    fi

    # JWT_SECRET
    if grep -q "^JWT_SECRET=" "$ENV_FILE"; then
        JWT=$(grep "^JWT_SECRET=" "$ENV_FILE" | cut -d'=' -f2-)
        JWT_LEN=${#JWT}
        if [ "$JWT_LEN" -lt 32 ]; then
            log_warning "JWT_SECRET trop court ($JWT_LEN chars, minimum 32 recommande)"
        elif [[ "$JWT" == *"CHANGE_ME"* ]] || [[ "$JWT" == *"your_"* ]] || [[ "$JWT" == *"secret"* ]]; then
            log_warning "JWT_SECRET semble etre une valeur par defaut"
        else
            log_success "JWT_SECRET definie (${JWT_LEN} caracteres)"
        fi
    else
        log_error "JWT_SECRET non definie"
    fi

    # POSTGRES_PASSWORD
    if grep -q "^POSTGRES_PASSWORD=" "$ENV_FILE"; then
        PG_PWD=$(grep "^POSTGRES_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2-)
        if [[ "$PG_PWD" == *"CHANGE_ME"* ]] || [[ "$PG_PWD" == *"password"* ]]; then
            log_warning "POSTGRES_PASSWORD semble etre une valeur par defaut"
        else
            log_success "POSTGRES_PASSWORD definie"
        fi
    else
        log_warning "POSTGRES_PASSWORD non definie (utilisera valeur docker-compose)"
    fi
fi

# Verification schema.prisma
PRISMA_SCHEMA="$PROJECT_ROOT/packages/database/prisma/schema.prisma"
if [ -f "$PRISMA_SCHEMA" ]; then
    if grep -q 'url.*=.*env("DATABASE_URL")' "$PRISMA_SCHEMA"; then
        log_success "schema.prisma utilise env(\"DATABASE_URL\")"
    elif grep -q 'url.*=.*"postgresql://' "$PRISMA_SCHEMA"; then
        log_error "schema.prisma contient une URL en dur (faille securite)"
    else
        log_warning "schema.prisma: configuration datasource non standard"
    fi
else
    log_error "schema.prisma non trouve"
fi

###############################################################################
# 3. Verification de la structure du projet
###############################################################################

separator "3. VERIFICATION DE LA STRUCTURE DU PROJET"

# node_modules racine
if [ -d "$PROJECT_ROOT/node_modules" ]; then
    log_success "node_modules present a la racine"
else
    log_warning "node_modules absent - executez 'pnpm install'"
fi

# Packages requis
PACKAGES=("database" "types" "utils" "config" "ui")
for pkg in "${PACKAGES[@]}"; do
    if [ -d "$PROJECT_ROOT/packages/$pkg" ]; then
        log_success "Package $pkg present"
    else
        log_error "Package $pkg manquant"
    fi
done

# Applications
APPS=("api" "web")
for app in "${APPS[@]}"; do
    if [ -d "$PROJECT_ROOT/apps/$app" ]; then
        log_success "Application $app presente"
    else
        log_error "Application $app manquante"
    fi
done

###############################################################################
# 4. Verification des services Docker
###############################################################################

separator "4. VERIFICATION DES SERVICES DOCKER"

if command -v docker &> /dev/null; then
    # PostgreSQL
    if docker ps --format '{{.Names}}' | grep -q "orchestr-a-db\|orchestr-a-postgres"; then
        PG_STATUS=$(docker inspect --format='{{.State.Health.Status}}' orchestr-a-db 2>/dev/null || echo "unknown")
        if [ "$PG_STATUS" = "healthy" ]; then
            log_success "PostgreSQL en cours d'execution (healthy)"
        else
            log_warning "PostgreSQL en cours d'execution (status: $PG_STATUS)"
        fi
    else
        log_warning "PostgreSQL non demarre - executez 'pnpm run docker:dev'"
    fi

    # Redis
    if docker ps --format '{{.Names}}' | grep -q "orchestr-a-redis"; then
        REDIS_STATUS=$(docker inspect --format='{{.State.Health.Status}}' orchestr-a-redis 2>/dev/null || echo "unknown")
        if [ "$REDIS_STATUS" = "healthy" ]; then
            log_success "Redis en cours d'execution (healthy)"
        else
            log_warning "Redis en cours d'execution (status: $REDIS_STATUS)"
        fi
    else
        log_warning "Redis non demarre - executez 'pnpm run docker:dev'"
    fi
fi

###############################################################################
# 5. Verification vitest.config.ts
###############################################################################

separator "5. VERIFICATION CONFIGURATION VITEST"

VITEST_CONFIG="$PROJECT_ROOT/apps/api/vitest.config.ts"
if [ -f "$VITEST_CONFIG" ]; then
    # Verifier syntaxe correcte (server.deps.inline au lieu de deps.inline)
    if grep -q "server:" "$VITEST_CONFIG" && grep -q "deps:" "$VITEST_CONFIG"; then
        if grep -A5 "server:" "$VITEST_CONFIG" | grep -q "deps:"; then
            log_success "vitest.config.ts utilise server.deps.inline (syntaxe Vitest 4.x)"
        else
            log_warning "vitest.config.ts: verifiez la structure server.deps"
        fi
    elif grep -q "^\s*deps:" "$VITEST_CONFIG" && ! grep -B5 "deps:" "$VITEST_CONFIG" | grep -q "server:"; then
        log_error "vitest.config.ts utilise deps.inline (deprecie dans Vitest 4.x)"
        log_info "  Correction: remplacer 'deps: { inline: [...] }' par 'server: { deps: { inline: [...] } }'"
    else
        log_success "vitest.config.ts semble correctement configure"
    fi
else
    log_warning "vitest.config.ts non trouve"
fi

###############################################################################
# RESUME
###############################################################################

separator "RESUME"

echo ""
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}Toutes les verifications sont passees avec succes !${NC}"
    echo -e "${GREEN}Le projet est pret pour le deploiement.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}Verifications terminees avec $WARNINGS avertissement(s).${NC}"
    echo -e "${YELLOW}Le deploiement est possible mais certains points meritent attention.${NC}"
    exit 0
else
    echo -e "${RED}Verifications terminees avec $ERRORS erreur(s) et $WARNINGS avertissement(s).${NC}"
    echo -e "${RED}Corrigez les erreurs avant de deployer.${NC}"
    exit 1
fi
