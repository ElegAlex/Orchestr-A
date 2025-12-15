#!/bin/bash
# ============================================================================
# ORCHESTR'A - Environment Initialization Script
# ============================================================================
# Generates secure secrets and creates the .env.production file
#
# Usage:
#   ./scripts/init-env.sh                    # Creates .env.production
#   ./scripts/init-env.sh .env.staging       # Creates .env.staging
#   ./scripts/init-env.sh --force            # Overwrites if exists
#
# ============================================================================

set -e

# ========================================
# Configuration
# ========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE=".env.production"
FORCE_OVERWRITE=false

# ========================================
# Colors
# ========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ========================================
# Functions
# ========================================
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║          ORCHESTR'A - Environment Initialization             ║"
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
    echo -e "${RED}[ERROR]${NC} $1"
}

generate_secret() {
    local length="${1:-32}"
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$length"
}

generate_jwt_secret() {
    openssl rand -base64 64
}

show_help() {
    echo "Usage: $0 [OPTIONS] [ENV_FILE]"
    echo ""
    echo "Generates a production environment file with secure random secrets."
    echo ""
    echo "Arguments:"
    echo "  ENV_FILE              Output file (default: .env.production)"
    echo ""
    echo "Options:"
    echo "  -f, --force           Overwrite existing file without prompting"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Creates .env.production"
    echo "  $0 .env.staging       # Creates .env.staging"
    echo "  $0 --force            # Overwrites .env.production if exists"
}

# ========================================
# Argument parsing
# ========================================
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE_OVERWRITE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            ENV_FILE="$1"
            shift
            ;;
    esac
done

# ========================================
# Main
# ========================================
cd "$PROJECT_ROOT"
print_banner

# Check openssl availability
if ! command -v openssl &> /dev/null; then
    log_error "openssl is required but not installed."
    exit 1
fi

# Check if file already exists
if [ -f "$ENV_FILE" ]; then
    if [ "$FORCE_OVERWRITE" = true ]; then
        log_warning "Overwriting existing $ENV_FILE (--force)"
    else
        log_warning "$ENV_FILE already exists."
        echo ""
        read -p "Overwrite? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Aborted. Use --force to overwrite."
            exit 0
        fi
    fi
    # Backup existing file
    BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d-%H%M%S)"
    cp "$ENV_FILE" "$BACKUP_FILE"
    log_info "Backup created: $BACKUP_FILE"
fi

# Generate secrets
log_info "Generating secure secrets..."

DB_PASSWORD=$(generate_secret 32)
REDIS_PASSWORD=$(generate_secret 32)
JWT_SECRET=$(generate_jwt_secret)

log_success "Secrets generated"

# Create .env file
log_info "Creating $ENV_FILE..."

cat > "$ENV_FILE" << EOF
# ═══════════════════════════════════════════════════════════════════════════════
# ORCHESTR'A - Production Configuration
# ═══════════════════════════════════════════════════════════════════════════════
# Generated: $(date -Iseconds)
# Generator: scripts/init-env.sh
#
# WARNING: This file contains secrets. Do NOT commit to version control.
# ═══════════════════════════════════════════════════════════════════════════════

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │ SECRETS (Auto-generated)                                                    │
# └─────────────────────────────────────────────────────────────────────────────┘
DATABASE_PASSWORD=$DB_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
JWT_SECRET=$JWT_SECRET

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │ DOMAIN CONFIGURATION (EDIT THIS SECTION)                                    │
# └─────────────────────────────────────────────────────────────────────────────┘
# Your production domain - REQUIRED for CORS
# Examples: https://app.example.com, https://orchestr-a.company.fr
CORS_ORIGIN=https://your-domain.com

# API URL as seen from the browser (use /api if behind nginx)
NEXT_PUBLIC_API_URL=/api

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │ DATABASE                                                                    │
# └─────────────────────────────────────────────────────────────────────────────┘
DATABASE_NAME=orchestr_a_prod
DATABASE_USER=orchestr_a

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │ AUTHENTICATION                                                              │
# └─────────────────────────────────────────────────────────────────────────────┘
JWT_EXPIRES_IN=7d

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │ SECURITY                                                                    │
# └─────────────────────────────────────────────────────────────────────────────┘
THROTTLE_LIMIT=100
THROTTLE_TTL=60
SWAGGER_ENABLED=false

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │ NETWORK                                                                     │
# └─────────────────────────────────────────────────────────────────────────────┘
HTTP_PORT=80
HTTPS_PORT=443

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │ OPTIONAL - Email (uncomment to enable)                                      │
# └─────────────────────────────────────────────────────────────────────────────┘
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=noreply@example.com
# SMTP_PASSWORD=
# SMTP_FROM=ORCHESTR'A <noreply@example.com>

# ┌─────────────────────────────────────────────────────────────────────────────┐
# │ OPTIONAL - Monitoring (uncomment to enable)                                 │
# └─────────────────────────────────────────────────────────────────────────────┘
# SENTRY_DSN=https://xxx@sentry.io/xxx
# SENTRY_ENVIRONMENT=production
EOF

log_success "$ENV_FILE created successfully!"

# ========================================
# Summary
# ========================================
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Configuration generated successfully!${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Generated secrets:${NC}"
echo "  DATABASE_PASSWORD: ${DB_PASSWORD:0:8}************************"
echo "  REDIS_PASSWORD:    ${REDIS_PASSWORD:0:8}************************"
echo "  JWT_SECRET:        ${JWT_SECRET:0:16}..."
echo ""
echo -e "${YELLOW}NEXT STEP:${NC}"
echo "  1. Edit $ENV_FILE"
echo "  2. Set CORS_ORIGIN to your actual domain"
echo ""
echo -e "${GREEN}Then deploy:${NC}"
echo "  docker compose --env-file $ENV_FILE -f docker-compose.prod.yml up -d"
echo ""
