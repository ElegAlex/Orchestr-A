#!/bin/bash
#
# Script de sauvegarde automatique de la base de données PostgreSQL
# Usage: ./scripts/backup-database.sh
#

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="orchestr-a-backup-${DATE}.sql"
CONTAINER_NAME="orchestr-a-postgres-prod"
DATABASE_NAME="orchestr_a_prod"
DATABASE_USER="postgres"
RETENTION_DAYS=30

echo "🗄️  Démarrage de la sauvegarde de la base de données..."
echo "📅 Date: $(date)"
echo "📦 Container: ${CONTAINER_NAME}"
echo "💾 Base de données: ${DATABASE_NAME}"
echo ""

# Créer le répertoire de sauvegarde s'il n'existe pas
mkdir -p "${BACKUP_DIR}"

# Effectuer le dump de la base de données
echo "🔄 Création du dump..."
docker exec "${CONTAINER_NAME}" pg_dump -U "${DATABASE_USER}" "${DATABASE_NAME}" > "${BACKUP_DIR}/${BACKUP_FILE}"

# Vérifier que le fichier a été créé
if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    FILE_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    echo "✅ Sauvegarde créée avec succès: ${BACKUP_FILE} (${FILE_SIZE})"

    # Compresser la sauvegarde
    echo "🗜️  Compression de la sauvegarde..."
    gzip "${BACKUP_DIR}/${BACKUP_FILE}"
    COMPRESSED_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}.gz" | cut -f1)
    echo "✅ Sauvegarde compressée: ${BACKUP_FILE}.gz (${COMPRESSED_SIZE})"
else
    echo "❌ Erreur: La sauvegarde n'a pas été créée"
    exit 1
fi

# Nettoyer les anciennes sauvegardes
echo ""
echo "🧹 Nettoyage des sauvegardes de plus de ${RETENTION_DAYS} jours..."
find "${BACKUP_DIR}" -name "orchestr-a-backup-*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
REMAINING_BACKUPS=$(find "${BACKUP_DIR}" -name "orchestr-a-backup-*.sql.gz" -type f | wc -l)
echo "✅ Sauvegardes restantes: ${REMAINING_BACKUPS}"

echo ""
echo "🎉 Sauvegarde terminée avec succès!"
echo "📁 Emplacement: ${BACKUP_DIR}/${BACKUP_FILE}.gz"
