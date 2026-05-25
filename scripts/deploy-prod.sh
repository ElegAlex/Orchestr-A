#!/usr/bin/env bash
###############################################################################
# ORCHESTR'A — Production redeploy runbook (OBS-012)
#
# This is the REAL deploy path. The old .github/workflows/deploy.yml was
# theatrical — its "Deploy to Server (SSH)" step only echoed instructions and
# never connected anywhere, while the actual deploy has always been a manual SSH
# + `docker compose` on the VPS. That workflow was removed (OBS-012) rather than
# faked; this script is its honest replacement, run BY THE OPERATOR ON THE VPS.
#
# What it does, in order:
#   1. Pull the target revision on /opt/orchestra.
#   2. Pin the release: write RELEASE_SHA + DEPLOYED_BY into .env.production so
#      the API records which version is live (DeploymentsService boot hook →
#      `deployments` table + a RELEASE_DEPLOYED row in audit_logs). This is what
#      lets an auditor answer "which release was running when leave Z was
#      approved" (see the SQL at the bottom of this file).
#   3. Build + migrate + up, always with --env-file .env.production (the prod
#      tree has no ambient .env; omitting it silently loses every secret).
#
# Usage (on the VPS, from /opt/orchestra):
#   ./scripts/deploy-prod.sh                         # deploy origin/master
#   ./scripts/deploy-prod.sh <git-ref>               # deploy a specific ref/SHA
#   DEPLOYED_BY=ab@alexandre-berge.fr ./scripts/deploy-prod.sh
#
# Prereqs: run as the deploy user with docker access, SSH key present, the prod
# .env.production in place. This script does NOT provision a fresh host — that is
# scripts/deploy-vps.sh (first-install only).
###############################################################################

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/orchestra}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
TARGET_REF="${1:-origin/master}"
DEPLOYED_BY="${DEPLOYED_BY:-$(whoami)@$(hostname -s 2>/dev/null || echo vps)}"

cd "$INSTALL_DIR"

echo "==> [1/5] Fetching and checking out ${TARGET_REF}"
git fetch --all --tags --prune
git checkout --detach "$TARGET_REF"
RELEASE_SHA="$(git rev-parse HEAD)"
echo "    Release SHA: ${RELEASE_SHA}"
echo "    Deployed by: ${DEPLOYED_BY}"

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: ${ENV_FILE} not found in ${INSTALL_DIR}. Refusing to deploy without it." >&2
    exit 1
fi

echo "==> [2/5] Pinning release into ${ENV_FILE} (RELEASE_SHA / DEPLOYED_BY / DEPLOY_ENVIRONMENT)"
# Replace-or-append each key so the running container self-records its version.
upsert_env() {
    local key="$1" value="$2"
    if grep -q "^${key}=" "$ENV_FILE"; then
        # Use a non-/ delimiter; SHAs and emails contain no '|'.
        sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
        printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    fi
}
upsert_env "RELEASE_SHA" "$RELEASE_SHA"
upsert_env "DEPLOYED_BY" "$DEPLOYED_BY"
upsert_env "DEPLOY_ENVIRONMENT" "production"

echo "==> [3/5] Building images (source-baked) with --env-file ${ENV_FILE}"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

echo "==> [4/5] Applying migrations + starting services"
# The API entrypoint runs `prisma migrate deploy` on boot; `up -d` triggers it.
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "==> [5/5] Deploy submitted. Verify:"
echo "    docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} ps"
echo "    docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} logs -f api"
echo ""
echo "On boot the API writes one row to \"deployments\" (releaseSha=${RELEASE_SHA})"
echo "and one RELEASE_DEPLOYED row to audit_logs."
echo ""
echo "Audit query — which release was live at a given timestamp:"
echo "  SELECT \"releaseSha\", \"deployedAt\", \"deployedBy\""
echo "  FROM deployments"
echo "  WHERE \"deployedAt\" <= '<timestamp>'"
echo "  ORDER BY \"deployedAt\" DESC"
echo "  LIMIT 1;"
