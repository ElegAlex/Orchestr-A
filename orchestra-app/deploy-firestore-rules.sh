#!/bin/bash

# ========================================================================
# Script de déploiement des règles Firestore SÉCURISÉES
# Orchestr'A - Mise à jour: 2025-10-02
# ========================================================================

set -e  # Arrêt en cas d'erreur

echo "🔒 ========================================="
echo "   DÉPLOIEMENT RÈGLES FIRESTORE SÉCURISÉES"
echo "   Project: orchestr-a-3b48e"
echo "=========================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérification environnement
echo "📋 Vérification de l'environnement..."
echo ""

# 1. Vérifier que nous sommes dans le bon répertoire
if [ ! -f "firestore.rules" ]; then
    echo -e "${RED}❌ Erreur: firestore.rules introuvable${NC}"
    echo "   Exécutez ce script depuis le répertoire orchestra-app/"
    exit 1
fi

# 2. Vérifier que les règles ont été modifiées (pas en mode démo)
if grep -q "allow read, write: if true" firestore.rules; then
    echo -e "${RED}❌ ATTENTION: Les règles sont encore en mode DÉMO !${NC}"
    echo "   Le fichier contient 'allow read, write: if true'"
    echo ""
    read -p "⚠️  Voulez-vous vraiment déployer ces règles NON SÉCURISÉES ? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Déploiement annulé"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Règles sécurisées détectées${NC}"
fi

# 3. Afficher un résumé des règles
echo ""
echo "📊 Résumé des règles de sécurité:"
echo ""

# Compter les fonctions RACI
RACI_FUNCTIONS=$(grep -c "function is.*For\|canModifyTask" firestore.rules || echo "0")
echo "   - Fonctions RACI: $RACI_FUNCTIONS"

# Compter les collections sécurisées
COLLECTIONS=$(grep -c "match /.*/{" firestore.rules || echo "0")
echo "   - Collections: $COLLECTIONS"

# Vérifier support RACI pour tasks
if grep -q "canModifyTask" firestore.rules; then
    echo -e "   - ${GREEN}✅ Support RACI pour tasks activé${NC}"
else
    echo -e "   - ${YELLOW}⚠️  Support RACI pour tasks non détecté${NC}"
fi

# 4. Backup des règles actuelles en production (optionnel)
echo ""
echo "💾 Backup des règles actuelles en production..."
BACKUP_FILE="firestore.rules.backup-$(date +%Y%m%d-%H%M%S)"

# Tentative de récupération des règles actuelles (peut échouer si non configuré)
firebase firestore:rules:get --project orchestr-a-3b48e > "$BACKUP_FILE" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Impossible de récupérer les règles actuelles (normal si première config)${NC}"
    rm -f "$BACKUP_FILE"
}

# 5. Validation syntax (dry-run)
echo ""
echo "🔍 Validation de la syntaxe..."
firebase deploy --only firestore:rules --project orchestr-a-3b48e --dry-run 2>&1 | grep -i "error\|warning" && {
    echo -e "${RED}❌ Erreurs de syntaxe détectées${NC}"
    exit 1
} || echo -e "${GREEN}✅ Syntaxe valide${NC}"

# 6. Confirmation finale
echo ""
echo -e "${YELLOW}⚠️  ATTENTION: Cette action va REMPLACER les règles Firestore en production${NC}"
echo ""
echo "Project: orchestr-a-3b48e"
echo "Fichier: firestore.rules ($(wc -l < firestore.rules) lignes)"
echo ""
read -p "🚀 Confirmer le déploiement ? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Déploiement annulé"
    exit 0
fi

# 7. Déploiement avec credentials
echo ""
echo "🚀 Déploiement en cours..."
echo ""

# Utiliser les vraies credentials comme pour le hosting
export GOOGLE_APPLICATION_CREDENTIALS="./service-account-real.json"
firebase deploy --only firestore:rules --project orchestr-a-3b48e

# 8. Résultat
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ RÈGLES DÉPLOYÉES AVEC SUCCÈS !${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "📌 Prochaines étapes recommandées:"
    echo ""
    echo "   1. Tester l'application avec différents rôles:"
    echo "      - Admin"
    echo "      - Manager"
    echo "      - Référent technique"
    echo "      - Utilisateur simple"
    echo ""
    echo "   2. Vérifier les permissions RACI:"
    echo "      - Créer une tâche avec responsible[]"
    echo "      - Tester modification par responsible"
    echo "      - Tester modification par accountable"
    echo ""
    echo "   3. Surveiller les erreurs dans la console Firebase:"
    echo "      https://console.firebase.google.com/project/orchestr-a-3b48e/firestore/rules"
    echo ""

    if [ -f "$BACKUP_FILE" ]; then
        echo "💾 Backup disponible: $BACKUP_FILE"
        echo ""
    fi
else
    echo ""
    echo -e "${RED}❌ ÉCHEC DU DÉPLOIEMENT${NC}"
    echo ""
    echo "Consultez les erreurs ci-dessus"
    exit 1
fi
