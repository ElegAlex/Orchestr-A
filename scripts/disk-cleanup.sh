#!/usr/bin/env bash
#
# Orchestr'A - Weekly docker prune + disk surveillance (prod)
# Usage : invoqué par la crontab root du VPS le dimanche 04:00.
#   0 4 * * 0 /opt/orchestra/scripts/disk-cleanup.sh
#
# 1) Mesure l'occupation disque de / et /var/lib/docker.
# 2) Si /var/lib/docker >80% : docker system prune -af (sans --volumes pour
#    préserver les volumes DB).
# 3) Post-prune, si encore >85% : alerte via logger (syslog → journalctl).
#    La bascule vers un canal email/webhook est à décider (cf. rapport).
#
# Exit codes :
#   0 = rien à faire / prune exécuté normalement
#   1 = erreur docker / df
#   2 = alerte : après prune, disque toujours >85%
#

set -u

LOG_FILE="/var/log/orchestra-disk.log"
LOG_TAG="orchestra-disk"
THRESHOLD_PRUNE=80
THRESHOLD_ALERT=85

log() {
    local level="$1"; shift
    local msg="$*"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [${level}] ${msg}" >> "${LOG_FILE}"
    # Propagation syslog (priority info/warning/err selon niveau)
    case "${level}" in
        ERROR)  logger -t "${LOG_TAG}" -p user.err    "${msg}" ;;
        WARN)   logger -t "${LOG_TAG}" -p user.warning "${msg}" ;;
        ALERT)  logger -t "${LOG_TAG}" -p user.crit   "${msg}" ;;
        *)      logger -t "${LOG_TAG}" -p user.info   "${msg}" ;;
    esac
}

# Pourcentage utilisé d'un mount point (sans le %)
pct_used() {
    df --output=pcent "$1" 2>/dev/null | tail -1 | tr -dc '0-9'
}

touch "${LOG_FILE}" 2>/dev/null || true
log INFO "Disk cleanup start"

ROOT_PCT=$(pct_used /)
DOCKER_PCT=$(pct_used /var/lib/docker)

if [ -z "${ROOT_PCT}" ] || [ -z "${DOCKER_PCT}" ]; then
    log ERROR "df failed (root=${ROOT_PCT:-?} docker=${DOCKER_PCT:-?})"
    exit 1
fi

log INFO "Baseline: / = ${ROOT_PCT}%, /var/lib/docker = ${DOCKER_PCT}%"

# Seul le disque docker déclenche le prune. / est mesuré pour journal.
if [ "${DOCKER_PCT}" -gt "${THRESHOLD_PRUNE}" ]; then
    log WARN "Docker disk >${THRESHOLD_PRUNE}% — running 'docker system prune -af' (volumes preserved)"
    BEFORE=$(df --output=avail /var/lib/docker | tail -1 | tr -d ' ')
    if ! docker system prune -af >>"${LOG_FILE}" 2>&1; then
        log ERROR "docker system prune failed"
        exit 1
    fi
    AFTER=$(df --output=avail /var/lib/docker | tail -1 | tr -d ' ')
    FREED_KB=$(( AFTER - BEFORE ))
    FREED_MB=$(( FREED_KB / 1024 ))
    log INFO "Prune done, freed ~${FREED_MB} MB"

    # Revérifier l'occupation
    DOCKER_PCT=$(pct_used /var/lib/docker)
    log INFO "Post-prune: /var/lib/docker = ${DOCKER_PCT}%"
else
    log INFO "Docker disk ${DOCKER_PCT}% <= ${THRESHOLD_PRUNE}%, prune skipped"
fi

if [ "${DOCKER_PCT}" -gt "${THRESHOLD_ALERT}" ]; then
    log ALERT "Disk saturation after prune: /var/lib/docker = ${DOCKER_PCT}% (> ${THRESHOLD_ALERT}%) — manual intervention needed"
    # NOTE : un canal d'alerte externe (mail / webhook) reste à brancher ici.
    # mailutils/sendmail absents sur le VPS au 2026-04-20. Arbitrage dans rapport.
    exit 2
fi

log INFO "Disk cleanup done OK"
exit 0
