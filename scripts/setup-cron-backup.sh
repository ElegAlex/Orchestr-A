#!/bin/bash
###############################################################################
# ORCHESTR'A V2 - Configuration Backup Automatique via Cron
###############################################################################
# Ce script configure une tâche cron pour les backups automatiques quotidiens
# Exécution: Tous les jours à 2h00 du matin
###############################################################################

set -e

# Configuration
PROJECT_DIR="/home/alex/Documents/Repository/orchestr-a-refonte"
BACKUP_SCRIPT="${PROJECT_DIR}/scripts/backup-database.sh"
CRON_TIME="0 2 * * *"  # 2h00 tous les jours

echo "=========================================="
echo "Configuration des backups automatiques"
echo "=========================================="
echo ""

# Vérifier que le script de backup existe
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "❌ Erreur: Le script de backup n'existe pas: $BACKUP_SCRIPT"
    exit 1
fi

# Rendre le script exécutable
chmod +x "$BACKUP_SCRIPT"
echo "✓ Script de backup rendu exécutable"

# Créer la commande cron
CRON_COMMAND="$CRON_TIME $BACKUP_SCRIPT >> ${PROJECT_DIR}/backups/logs/backup-cron.log 2>&1"

# Vérifier si la tâche cron existe déjà
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo "⚠️  Une tâche cron existe déjà pour ce script"
    echo ""
    echo "Tâches cron actuelles:"
    crontab -l | grep "$BACKUP_SCRIPT" || true
    echo ""
    read -p "Voulez-vous la remplacer? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Configuration annulée"
        exit 0
    fi

    # Supprimer l'ancienne tâche
    (crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT") | crontab -
    echo "✓ Ancienne tâche supprimée"
fi

# Ajouter la nouvelle tâche cron
(crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -

echo ""
echo "=========================================="
echo "✅ Configuration réussie!"
echo "=========================================="
echo ""
echo "Détails de la tâche cron:"
echo "  Fréquence: Tous les jours à 2h00 du matin"
echo "  Script: $BACKUP_SCRIPT"
echo "  Logs: ${PROJECT_DIR}/backups/logs/backup-cron.log"
echo ""
echo "Pour vérifier les tâches cron:"
echo "  crontab -l"
echo ""
echo "Pour supprimer cette tâche:"
echo "  crontab -e"
echo "  # Supprimer la ligne contenant: $BACKUP_SCRIPT"
echo ""
echo "Pour tester le backup manuellement:"
echo "  $BACKUP_SCRIPT"
echo ""
