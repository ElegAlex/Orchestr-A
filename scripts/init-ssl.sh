#!/bin/bash
# ============================================================================
# ORCHESTR'A - SSL Initialization Script
# ============================================================================
# Obtains Let's Encrypt certificates via Docker
# Usage: ./scripts/init-ssl.sh --domain orchestr-a.com --email admin@example.com
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DOMAIN=""
EMAIL=""
STAGING=0

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_help() {
    echo "Usage: $0 --domain DOMAIN --email EMAIL [OPTIONS]"
    echo ""
    echo "Obtains Let's Encrypt SSL certificates for ORCHESTR'A via Docker."
    echo ""
    echo "Required:"
    echo "  --domain DOMAIN    Domain name (e.g., orchestr-a.com)"
    echo "  --email EMAIL      Email for Let's Encrypt notifications"
    echo ""
    echo "Options:"
    echo "  --staging          Use Let's Encrypt staging (for testing)"
    echo "  -h, --help         Show this help"
    echo ""
    echo "Example:"
    echo "  $0 --domain orchestr-a.com --email admin@orchestr-a.com"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain) DOMAIN="$2"; shift 2 ;;
            --email) EMAIL="$2"; shift 2 ;;
            --staging) STAGING=1; shift ;;
            -h|--help) show_help; exit 0 ;;
            *) log_error "Unknown option: $1"; show_help; exit 1 ;;
        esac
    done

    if [ -z "$DOMAIN" ]; then
        log_error "Domain is required (--domain)"
        exit 1
    fi

    if [ -z "$EMAIL" ]; then
        log_error "Email is required (--email)"
        exit 1
    fi
}

check_dns() {
    log_info "Checking DNS for $DOMAIN..."

    RESOLVED_IP=$(dig +short "$DOMAIN" | head -1)
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null)

    if [ -z "$RESOLVED_IP" ]; then
        log_error "Domain $DOMAIN does not resolve to an IP"
        log_error "Configure an A record pointing to $SERVER_IP"
        exit 1
    fi

    if [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
        log_warning "Domain $DOMAIN resolves to $RESOLVED_IP"
        log_warning "This server's IP is $SERVER_IP"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        log_success "DNS correctly configured ($DOMAIN -> $SERVER_IP)"
    fi
}

update_nginx_config() {
    log_info "Updating nginx configuration for $DOMAIN..."

    # Update domain in nginx.conf
    sed -i "s/server_name orchestr-a.com www.orchestr-a.com;/server_name ${DOMAIN} www.${DOMAIN};/g" nginx/nginx.conf
    sed -i "s|/etc/nginx/ssl/live/orchestr-a.com/|/etc/nginx/ssl/live/${DOMAIN}/|g" nginx/nginx.conf

    log_success "nginx.conf updated for $DOMAIN"
}

update_env_file() {
    log_info "Updating .env.production..."

    if [ -f ".env.production" ]; then
        sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|" .env.production
        log_success ".env.production updated with CORS_ORIGIN=https://${DOMAIN}"
    else
        log_warning ".env.production not found. Run ./scripts/init-env.sh first"
    fi
}

obtain_certificate() {
    log_info "Obtaining SSL certificate for $DOMAIN..."

    # Staging flag for testing
    STAGING_FLAG=""
    if [ "$STAGING" -eq 1 ]; then
        STAGING_FLAG="--staging"
        log_warning "Using Let's Encrypt STAGING environment (certificates won't be valid)"
    fi

    # Create volumes if they don't exist
    docker volume create orchestr-a-certbot-certs 2>/dev/null || true
    docker volume create orchestr-a-certbot-www 2>/dev/null || true

    # Run certbot in Docker
    docker run --rm \
        -v orchestr-a-certbot-certs:/etc/letsencrypt \
        -v orchestr-a-certbot-www:/var/www/certbot \
        -p 80:80 \
        certbot/certbot certonly \
        --standalone \
        --preferred-challenges http \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive \
        $STAGING_FLAG

    log_success "SSL certificate obtained for $DOMAIN"
}

start_services() {
    log_info "Starting services..."

    docker compose --env-file .env.production -f docker-compose.prod.yml up -d

    log_success "Services started"
}

print_summary() {
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}              SSL CONFIGURED SUCCESSFULLY                       ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}Domain:${NC} $DOMAIN"
    echo -e "${CYAN}URL:${NC} https://${DOMAIN}"
    echo ""
    echo -e "${CYAN}Certificate renewal:${NC} Automatic (certbot container)"
    echo ""
    echo -e "${CYAN}Test SSL:${NC}"
    echo "  curl https://${DOMAIN}/api/health"
    echo ""
    if [ "$STAGING" -eq 1 ]; then
        echo -e "${YELLOW}NOTE: Using staging certificates. Re-run without --staging for production.${NC}"
        echo ""
    fi
}

main() {
    echo -e "${CYAN}ORCHESTR'A - SSL Initialization${NC}"
    echo ""

    parse_args "$@"

    # Ensure we're in project root
    if [ ! -f "docker-compose.prod.yml" ]; then
        log_error "Run this script from the project root directory"
        exit 1
    fi

    check_dns
    update_nginx_config
    update_env_file

    # Stop nginx if running (to free port 80)
    docker compose --env-file .env.production -f docker-compose.prod.yml stop nginx 2>/dev/null || true

    obtain_certificate
    start_services
    print_summary
}

main "$@"
