#!/bin/bash

###############################################################################
# ORCHESTR'A - Script de Configuration SSL
# Usage: sudo ./configure-ssl.sh --domain orchestr-a.example.com [--email admin@example.com]
###############################################################################

set -e

# === COULEURS ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DOMAIN=""
EMAIL=""
INSTALL_DIR="/opt/ORCHESTRA"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERREUR]${NC} $1"; }

show_help() {
    echo "Usage: $0 --domain DOMAIN [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --domain DOMAIN   Nom de domaine (obligatoire)"
    echo "  --email EMAIL     Email pour Let's Encrypt (defaut: admin@DOMAIN)"
    echo "  --install-dir DIR Repertoire d'installation (defaut: /opt/ORCHESTRA)"
    echo "  -h, --help        Afficher cette aide"
    echo ""
    echo "Exemple:"
    echo "  $0 --domain orchestr-a.mondomaine.fr --email admin@mondomaine.fr"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain) DOMAIN="$2"; shift 2 ;;
            --email) EMAIL="$2"; shift 2 ;;
            --install-dir) INSTALL_DIR="$2"; shift 2 ;;
            -h|--help) show_help; exit 0 ;;
            *) log_error "Option inconnue: $1"; show_help; exit 1 ;;
        esac
    done

    if [ -z "$DOMAIN" ]; then
        log_error "Le domaine est obligatoire"
        show_help
        exit 1
    fi

    if [ -z "$EMAIL" ]; then
        EMAIL="admin@${DOMAIN}"
    fi
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Ce script doit etre execute en tant que root (sudo)"
        exit 1
    fi
}

check_domain_dns() {
    log_info "Verification DNS pour $DOMAIN..."

    RESOLVED_IP=$(dig +short "$DOMAIN" | head -1)
    SERVER_IP=$(curl -s ifconfig.me)

    if [ -z "$RESOLVED_IP" ]; then
        log_error "Le domaine $DOMAIN ne resout pas vers une adresse IP"
        log_error "Configurez un enregistrement A pointant vers $SERVER_IP"
        exit 1
    fi

    if [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
        log_warning "Le domaine $DOMAIN resout vers $RESOLVED_IP"
        log_warning "L'IP de ce serveur est $SERVER_IP"
        read -p "Continuer malgre tout? (o/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
            exit 1
        fi
    else
        log_success "DNS correctement configure ($DOMAIN -> $SERVER_IP)"
    fi
}

install_certbot() {
    if command -v certbot &> /dev/null; then
        log_info "Certbot deja installe"
    else
        log_info "Installation de Certbot..."
        apt-get update -qq
        apt-get install -y -qq certbot python3-certbot-nginx
        log_success "Certbot installe"
    fi
}

update_nginx_config() {
    log_info "Mise a jour de la configuration Nginx..."

    local NGINX_CONF="/etc/nginx/sites-available/orchestr-a"

    if [ ! -f "$NGINX_CONF" ]; then
        log_error "Configuration Nginx non trouvee: $NGINX_CONF"
        exit 1
    fi

    # Mettre a jour le server_name
    sed -i "s/server_name .*;/server_name ${DOMAIN};/" "$NGINX_CONF"

    nginx -t
    systemctl reload nginx

    log_success "Configuration Nginx mise a jour"
}

obtain_certificate() {
    log_info "Obtention du certificat SSL pour $DOMAIN..."

    certbot --nginx \
        -d "$DOMAIN" \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        --redirect

    log_success "Certificat SSL obtenu et configure"
}

update_env_file() {
    log_info "Mise a jour du fichier .env..."

    local ENV_FILE="$INSTALL_DIR/.env"

    if [ -f "$ENV_FILE" ]; then
        # Mettre a jour NEXT_PUBLIC_API_URL et ALLOWED_ORIGINS
        sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://${DOMAIN}/api|" "$ENV_FILE"
        sed -i "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://${DOMAIN}|" "$ENV_FILE"
        log_success "Fichier .env mis a jour"
    else
        log_warning "Fichier .env non trouve, mise a jour manuelle necessaire"
    fi
}

setup_auto_renewal() {
    log_info "Configuration du renouvellement automatique..."

    # Certbot installe automatiquement un timer systemd
    systemctl enable certbot.timer
    systemctl start certbot.timer

    # Ajouter un hook pour recharger nginx apres renouvellement
    mkdir -p /etc/letsencrypt/renewal-hooks/deploy
    cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh << 'EOF'
#!/bin/bash
systemctl reload nginx
EOF
    chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

    log_success "Renouvellement automatique configure"
}

restart_services() {
    log_info "Redemarrage des services..."

    systemctl restart orchestr-a-api || log_warning "Service API non trouve"
    systemctl restart orchestr-a-web || log_warning "Service Web non trouve"
    systemctl reload nginx

    log_success "Services redemarres"
}

print_summary() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}              SSL CONFIGURE AVEC SUCCES                        ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}Domaine:${NC} $DOMAIN"
    echo -e "${CYAN}URL:${NC} https://${DOMAIN}"
    echo ""
    echo -e "${CYAN}Certificat:${NC}"
    echo -e "  Chemin: /etc/letsencrypt/live/${DOMAIN}/"
    echo -e "  Renouvellement: automatique (certbot.timer)"
    echo ""
    echo -e "${CYAN}Test du certificat:${NC}"
    echo -e "  certbot certificates"
    echo ""
    echo -e "${CYAN}Test SSL en ligne:${NC}"
    echo -e "  https://www.ssllabs.com/ssltest/analyze.html?d=${DOMAIN}"
    echo ""
}

main() {
    echo -e "${CYAN}ORCHESTR'A - Configuration SSL${NC}"
    echo ""

    check_root
    parse_args "$@"
    check_domain_dns
    install_certbot
    update_nginx_config
    obtain_certificate
    update_env_file
    setup_auto_renewal
    restart_services
    print_summary
}

main "$@"
