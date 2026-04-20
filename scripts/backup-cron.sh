#!/usr/bin/env bash
#
# Orchestr'A - Daily backup cron (prod)
# Usage : invoqué par la crontab root du VPS à 03:00 quotidien.
#   0 3 * * * /opt/orchestra/scripts/backup-cron.sh
#
# Produit un pg_dump compressible du container orchestr-a-postgres-prod,
# tourne les backups > 14 jours, journalise l'exécution.
# Exit codes :
#   0 = succès
#   1 = pg_dump a échoué
#   2 = fichier produit < 100 Ko (faux succès détecté)
#

set -u

CONTAINER="orchestr-a-postgres-prod"
DB_USER="orchestr_a"
DB_NAME="orchestr_a_prod"
BACKUP_DIR="/opt/orchestra/backups-prod/daily"
LOG_FILE="/var/log/orchestra-backup.log"
RETENTION_DAYS=14
MIN_SIZE_BYTES=102400   # 100 Ko

TS=$(date +%Y%m%d-%H%M%S)
DUMP_FILE="${BACKUP_DIR}/dump-${TS}.sql"

log() {
    local level="$1"; shift
    echo "$(date '+%Y-%m-%d %H:%M:%S') [${level}] $*" >> "${LOG_FILE}"
}

mkdir -p "${BACKUP_DIR}"
touch "${LOG_FILE}" 2>/dev/null || true

log INFO "Backup start (container=${CONTAINER}, db=${DB_NAME}, target=${DUMP_FILE})"

if ! docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" > "${DUMP_FILE}" 2>>"${LOG_FILE}"; then
    log ERROR "pg_dump failed (exit code $?)"
    rm -f "${DUMP_FILE}" 2>/dev/null
    exit 1
fi

if [ ! -s "${DUMP_FILE}" ]; then
    log ERROR "Dump file empty: ${DUMP_FILE}"
    rm -f "${DUMP_FILE}" 2>/dev/null
    exit 1
fi

FILE_SIZE=$(stat -c%s "${DUMP_FILE}")
if [ "${FILE_SIZE}" -lt "${MIN_SIZE_BYTES}" ]; then
    log ERROR "Dump suspicious: ${FILE_SIZE} bytes < ${MIN_SIZE_BYTES} (threshold). Kept for inspection."
    exit 2
fi

HUMAN_SIZE=$(du -h "${DUMP_FILE}" | cut -f1)
log INFO "Dump OK: ${DUMP_FILE} (${HUMAN_SIZE}, ${FILE_SIZE} bytes)"

# Rotation
DELETED=$(find "${BACKUP_DIR}" -maxdepth 1 -name 'dump-*.sql' -type f -mtime +${RETENTION_DAYS} -print -delete 2>/dev/null | wc -l)
REMAINING=$(find "${BACKUP_DIR}" -maxdepth 1 -name 'dump-*.sql' -type f | wc -l)
log INFO "Rotation: ${DELETED} deleted (>${RETENTION_DAYS}d), ${REMAINING} remaining"

log INFO "Backup done"
exit 0
