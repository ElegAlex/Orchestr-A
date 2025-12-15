#!/bin/bash

###############################################################################
# ORCHESTR'A - Script de Deploiement VPS
# Version: 1.0
# Compatible: Ubuntu 22.04+, Debian 11+
# Usage: curl -fsSL <URL>/deploy-vps.sh | sudo bash -s -- [OPTIONS]
###############################################################################

set -e

# === CONFIGURATION PAR DEFAUT ===
INSTALL_DIR="/opt/ORCHESTRA"
REPO_URL="https://gitlab.ersm-idf.cnamts.fr/DRSM_IDF/ORCHESTRA.git"
NODE_VERSION="22"
API_PORT="4000"
FRONTEND_PORT="3000"
DB_NAME="orchestr_a_prod"
DB_USER="orchestr_a"
DB_PASSWORD=""
JWT_SECRET=""
DOMAIN=""
ENABLE_SSL="false"
SKIP_DEPS="false"

# === COULEURS ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# === FONCTIONS UTILITAIRES ===

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║   ██████  ██████   ██████ ██   ██ ███████ ███████ ████████   ║"
    echo "║  ██    ██ ██   ██ ██      ██   ██ ██      ██         ██      ║"
    echo "║  ██    ██ ██████  ██      ███████ █████   ███████    ██      ║"
    echo "║  ██    ██ ██   ██ ██      ██   ██ ██           ██    ██      ║"
    echo "║   ██████  ██   ██  ██████ ██   ██ ███████ ███████    ██      ║"
    echo "║                                                               ║"
    echo "║              Script de Deploiement VPS v1.0                   ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERREUR]${NC} $1"
}

log_step() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
}

generate_password() {
    openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24
}

generate_jwt_secret() {
    openssl rand -base64 48
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Ce script doit etre execute en tant que root (sudo)"
        exit 1
    fi
}

# === PARSING DES ARGUMENTS ===

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --domain DOMAIN       Nom de domaine (ex: orchestr-a.example.com)"
    echo "  --repo URL            URL du depot Git (defaut: GitLab CNAM)"
    echo "  --db-password PWD     Mot de passe PostgreSQL (genere si absent)"
    echo "  --jwt-secret SECRET   Secret JWT (genere si absent)"
    echo "  --enable-ssl          Activer SSL avec Let's Encrypt"
    echo "  --skip-deps           Ne pas installer les dependances systeme"
    echo "  --api-port PORT       Port API (defaut: 4000)"
    echo "  --frontend-port PORT  Port Frontend (defaut: 3000)"
    echo "  -h, --help            Afficher cette aide"
    echo ""
    echo "Exemple:"
    echo "  $0 --domain orchestr-a.mondomaine.fr --enable-ssl"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --repo)
                REPO_URL="$2"
                shift 2
                ;;
            --db-password)
                DB_PASSWORD="$2"
                shift 2
                ;;
            --jwt-secret)
                JWT_SECRET="$2"
                shift 2
                ;;
            --enable-ssl)
                ENABLE_SSL="true"
                shift
                ;;
            --skip-deps)
                SKIP_DEPS="true"
                shift
                ;;
            --api-port)
                API_PORT="$2"
                shift 2
                ;;
            --frontend-port)
                FRONTEND_PORT="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Option inconnue: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Generer les secrets si non fournis
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD=$(generate_password)
        log_info "Mot de passe PostgreSQL genere automatiquement"
    fi

    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(generate_jwt_secret)
        log_info "Secret JWT genere automatiquement"
    fi
}

# === INSTALLATION DES DEPENDANCES ===

install_system_deps() {
    log_step "Installation des dependances systeme"

    # Mise a jour du systeme
    log_info "Mise a jour du systeme..."
    apt-get update -qq
    apt-get upgrade -y -qq

    # Installation des paquets de base
    log_info "Installation des paquets de base..."
    apt-get install -y -qq \
        curl \
        wget \
        git \
        build-essential \
        ca-certificates \
        gnupg \
        lsb-release \
        ufw \
        fail2ban \
        htop \
        unzip

    log_success "Dependances systeme installees"
}

install_docker() {
    log_step "Installation de Docker"

    if command -v docker &> /dev/null; then
        log_warning "Docker deja installe: $(docker --version)"
    else
        log_info "Installation de Docker..."

        # Ajout du depot Docker
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg

        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
          $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
          tee /etc/apt/sources.list.d/docker.list > /dev/null

        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

        # Demarrer Docker
        systemctl enable docker
        systemctl start docker

        log_success "Docker installe: $(docker --version)"
    fi
}

install_nodejs() {
    log_step "Installation de Node.js $NODE_VERSION"

    if command -v node &> /dev/null; then
        CURRENT_NODE=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$CURRENT_NODE" -ge "$NODE_VERSION" ]; then
            log_warning "Node.js deja installe: $(node -v)"
            return
        fi
    fi

    log_info "Installation de Node.js via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs

    log_success "Node.js installe: $(node -v)"
}

install_pnpm() {
    log_step "Installation de pnpm"

    if command -v pnpm &> /dev/null; then
        log_warning "pnpm deja installe: $(pnpm -v)"
    else
        log_info "Installation de pnpm..."
        npm install -g pnpm@9
        log_success "pnpm installe: $(pnpm -v)"
    fi
}

install_nginx() {
    log_step "Installation de Nginx"

    if command -v nginx &> /dev/null; then
        log_warning "Nginx deja installe"
    else
        log_info "Installation de Nginx..."
        apt-get install -y -qq nginx
        systemctl enable nginx
        log_success "Nginx installe"
    fi
}

# === DEPLOIEMENT APPLICATION ===

clone_repository() {
    log_step "Clonage du depot"

    if [ -d "$INSTALL_DIR" ]; then
        log_warning "Le repertoire $INSTALL_DIR existe deja"
        read -p "Supprimer et recloner? (o/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[OoYy]$ ]]; then
            rm -rf "$INSTALL_DIR"
        else
            log_info "Conservation du repertoire existant"
            return
        fi
    fi

    log_info "Clonage depuis $REPO_URL..."
    git clone "$REPO_URL" "$INSTALL_DIR"

    log_success "Depot clone dans $INSTALL_DIR"
}

create_env_file() {
    log_step "Configuration de l'environnement"

    local ENV_FILE="$INSTALL_DIR/.env"
    local API_URL="http://localhost:${API_PORT}/api"

    if [ -n "$DOMAIN" ]; then
        if [ "$ENABLE_SSL" = "true" ]; then
            API_URL="https://${DOMAIN}/api"
        else
            API_URL="http://${DOMAIN}/api"
        fi
    fi

    log_info "Creation du fichier .env..."

    cat > "$ENV_FILE" << EOF
# ===========================
# FICHIER GENERE AUTOMATIQUEMENT
# Date: $(date '+%Y-%m-%d %H:%M:%S')
# ===========================

# === BASE DE DONNEES ===
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=${DB_NAME}
POSTGRES_PORT=5432

# === REDIS ===
REDIS_URL="redis://localhost:6379"
REDIS_PORT=6379

# === SECURITE ===
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=8h

# === API ===
API_PORT=${API_PORT}
API_PREFIX=/api
NODE_ENV=production
SWAGGER_ENABLED=false
ALLOWED_ORIGINS=${API_URL%/api}

# === FRONTEND ===
NEXT_PUBLIC_API_URL=${API_URL}
PORT=${FRONTEND_PORT}

# === LOGS ===
LOG_LEVEL=info
EOF

    # Copier aussi pour le package database
    ln -sf "$ENV_FILE" "$INSTALL_DIR/packages/database/.env"

    chmod 600 "$ENV_FILE"
    log_success "Fichier .env cree"

    # Sauvegarder les credentials
    local CREDS_FILE="$INSTALL_DIR/.credentials"
    cat > "$CREDS_FILE" << EOF
# CREDENTIALS ORCHESTR'A - CONSERVER EN LIEU SUR
# Genere le: $(date '+%Y-%m-%d %H:%M:%S')

Database:
  Host: localhost
  Port: 5432
  Name: ${DB_NAME}
  User: ${DB_USER}
  Password: ${DB_PASSWORD}

JWT Secret: ${JWT_SECRET}

Admin par defaut:
  Login: admin
  Password: admin123 (A CHANGER IMMEDIATEMENT)
EOF
    chmod 600 "$CREDS_FILE"
    log_warning "Credentials sauvegardes dans $CREDS_FILE"
}

install_dependencies() {
    log_step "Installation des dependances Node.js"

    cd "$INSTALL_DIR"

    log_info "Installation avec pnpm..."
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install

    log_success "Dependances installees"
}

start_docker_services() {
    log_step "Demarrage des services Docker"

    cd "$INSTALL_DIR"

    log_info "Demarrage de PostgreSQL et Redis..."
    docker compose up -d

    # Attendre que les services soient prets
    log_info "Attente du demarrage des services..."
    sleep 10

    # Verifier l'etat
    if docker ps | grep -q "orchestr-a-db.*healthy"; then
        log_success "PostgreSQL demarre et operationnel"
    else
        log_warning "PostgreSQL en cours de demarrage..."
        sleep 10
    fi

    if docker ps | grep -q "orchestr-a-redis.*healthy"; then
        log_success "Redis demarre et operationnel"
    else
        log_warning "Redis en cours de demarrage..."
    fi
}

run_migrations() {
    log_step "Execution des migrations de base de donnees"

    cd "$INSTALL_DIR"

    log_info "Generation du client Prisma..."
    cd packages/database
    pnpm run db:generate

    log_info "Execution des migrations..."
    pnpm run db:migrate:deploy

    log_info "Chargement des donnees initiales..."
    pnpm run db:seed || log_warning "Seed deja execute ou erreur (non bloquant)"

    cd "$INSTALL_DIR"
    log_success "Migrations terminees"
}

build_application() {
    log_step "Build de l'application"

    cd "$INSTALL_DIR"

    log_info "Build en cours (peut prendre quelques minutes)..."
    pnpm run build

    log_success "Build termine"
}

create_systemd_services() {
    log_step "Creation des services systemd"

    # Service API
    cat > /etc/systemd/system/orchestr-a-api.service << EOF
[Unit]
Description=ORCHESTR'A API (NestJS)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}/apps/api
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=${INSTALL_DIR}/.env

[Install]
WantedBy=multi-user.target
EOF

    # Service Frontend
    cat > /etc/systemd/system/orchestr-a-web.service << EOF
[Unit]
Description=ORCHESTR'A Frontend (Next.js)
After=network.target orchestr-a-api.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}/apps/web
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=${FRONTEND_PORT}
EnvironmentFile=${INSTALL_DIR}/.env

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable orchestr-a-api orchestr-a-web

    log_success "Services systemd crees"
}

configure_nginx() {
    log_step "Configuration de Nginx"

    local NGINX_CONF="/etc/nginx/sites-available/orchestr-a"
    local SERVER_NAME="${DOMAIN:-_}"

    cat > "$NGINX_CONF" << EOF
# ORCHESTR'A - Configuration Nginx
# Genere le: $(date '+%Y-%m-%d %H:%M:%S')

upstream api_backend {
    server 127.0.0.1:${API_PORT};
    keepalive 32;
}

upstream frontend_backend {
    server 127.0.0.1:${FRONTEND_PORT};
    keepalive 32;
}

server {
    listen 80;
    server_name ${SERVER_NAME};

    # Securite
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/orchestr-a-access.log;
    error_log /var/log/nginx/orchestr-a-error.log;

    # API
    location /api {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 300s;
    }

    # Frontend
    location / {
        proxy_pass http://frontend_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check
    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
EOF

    # Activer le site
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    # Tester la configuration
    nginx -t

    systemctl reload nginx
    log_success "Nginx configure"
}

configure_ssl() {
    if [ "$ENABLE_SSL" != "true" ] || [ -z "$DOMAIN" ]; then
        return
    fi

    log_step "Configuration SSL avec Let's Encrypt"

    # Installer certbot
    apt-get install -y -qq certbot python3-certbot-nginx

    log_info "Obtention du certificat SSL pour $DOMAIN..."
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect

    log_success "SSL configure pour $DOMAIN"
}

configure_firewall() {
    log_step "Configuration du pare-feu"

    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow http
    ufw allow https
    ufw --force enable

    log_success "Pare-feu configure (SSH, HTTP, HTTPS autorises)"
}

start_services() {
    log_step "Demarrage des services"

    systemctl start orchestr-a-api
    sleep 5
    systemctl start orchestr-a-web

    log_info "Verification des services..."
    sleep 5

    if systemctl is-active --quiet orchestr-a-api; then
        log_success "API demarree"
    else
        log_error "Echec demarrage API"
        journalctl -u orchestr-a-api -n 20 --no-pager
    fi

    if systemctl is-active --quiet orchestr-a-web; then
        log_success "Frontend demarre"
    else
        log_error "Echec demarrage Frontend"
        journalctl -u orchestr-a-web -n 20 --no-pager
    fi
}

print_summary() {
    log_step "DEPLOIEMENT TERMINE"

    local ACCESS_URL="http://${DOMAIN:-$(curl -s ifconfig.me)}"
    if [ "$ENABLE_SSL" = "true" ] && [ -n "$DOMAIN" ]; then
        ACCESS_URL="https://${DOMAIN}"
    fi

    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              ORCHESTR'A DEPLOYE AVEC SUCCES                   ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}URLs d'acces:${NC}"
    echo -e "  Application:  ${ACCESS_URL}"
    echo -e "  API:          ${ACCESS_URL}/api"
    echo ""
    echo -e "${CYAN}Identifiants par defaut:${NC}"
    echo -e "  Login:        admin"
    echo -e "  Mot de passe: admin123"
    echo -e "  ${RED}(A CHANGER IMMEDIATEMENT)${NC}"
    echo ""
    echo -e "${CYAN}Fichiers importants:${NC}"
    echo -e "  Configuration:  ${INSTALL_DIR}/.env"
    echo -e "  Credentials:    ${INSTALL_DIR}/.credentials"
    echo -e "  Logs API:       journalctl -u orchestr-a-api -f"
    echo -e "  Logs Frontend:  journalctl -u orchestr-a-web -f"
    echo ""
    echo -e "${CYAN}Commandes utiles:${NC}"
    echo -e "  Redemarrer API:      systemctl restart orchestr-a-api"
    echo -e "  Redemarrer Frontend: systemctl restart orchestr-a-web"
    echo -e "  Status services:     systemctl status orchestr-a-*"
    echo ""
}

# === MAIN ===

main() {
    print_banner
    check_root
    parse_args "$@"

    if [ "$SKIP_DEPS" != "true" ]; then
        install_system_deps
        install_docker
        install_nodejs
        install_pnpm
        install_nginx
    fi

    clone_repository
    create_env_file
    install_dependencies
    start_docker_services
    run_migrations
    build_application
    create_systemd_services
    configure_nginx
    configure_ssl
    configure_firewall
    start_services
    print_summary
}

main "$@"
