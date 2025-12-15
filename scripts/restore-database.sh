#!/bin/bash
#
# Script de restauration de la base de données PostgreSQL
# Usage: ./scripts/restore-database.sh <backup_file>
#

set -e

CONTAINER_NAME="orchestr-a-postgres-prod"
DATABASE_NAME="orchestr_a_prod"
DATABASE_USER="postgres"

if [ -z "$1" ]; then
    echo "❌ Erreur: Veuillez spécifier le fichier de sauvegarde"
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Sauvegardes disponibles:"
    ls -lh backups/*.sql.gz 2>/dev/null || echo "Aucune sauvegarde trouvée"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Erreur: Le fichier ${BACKUP_FILE} n'existe pas"
    exit 1
fi

echo "⚠️  ATTENTION: Cette opération va écraser la base de données actuelle!"
echo "📦 Container: ${CONTAINER_NAME}"
echo "💾 Base de données: ${DATABASE_NAME}"
echo "📁 Fichier de sauvegarde: ${BACKUP_FILE}"
echo ""
read -p "Êtes-vous sûr de vouloir continuer? (oui/non): " CONFIRM

if [ "$CONFIRM" != "oui" ]; then
    echo "❌ Restauration annulée"
    exit 0
fi

echo ""
echo "🔄 Démarrage de la restauration..."

# Décompresser si nécessaire
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    echo "🗜️  Décompression de la sauvegarde..."
    TEMP_FILE="/tmp/orchestr-a-restore-temp.sql"
    gunzip -c "${BACKUP_FILE}" > "${TEMP_FILE}"
    RESTORE_FILE="${TEMP_FILE}"
else
    RESTORE_FILE="${BACKUP_FILE}"
fi

# Restaurer la base de données
echo "📥 Restauration de la base de données..."
cat "${RESTORE_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DATABASE_USER}" -d "${DATABASE_NAME}"

# Nettoyer le fichier temporaire
if [ -f "${TEMP_FILE}" ]; then
    rm -f "${TEMP_FILE}"
fi

echo ""
echo "✅ Restauration terminée avec succès!"
