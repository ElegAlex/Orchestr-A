#!/bin/bash

echo "🧹 Nettoyage complet des console.log de debug..."

# Compter les console avant nettoyage
INITIAL_COUNT=$(grep -r "console\." src/ --include="*.tsx" --include="*.ts" | wc -l)
echo "📊 Console statements initiaux: $INITIAL_COUNT"

# Créer une sauvegarde
echo "💾 Création d'une sauvegarde..."
cp -r src src.backup.console.$(date +%Y%m%d_%H%M%S)

echo "🔧 Suppression des console.log de debug..."

# 1. Supprimer les console.log avec emojis (debug)
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log.*[🔍🧹🚀📋🗺️🏷️📦👥📁🔥🔐🏢👤📧❌✅📧🛠️🗑️🎨🔧⚡]/d' {} \;

# 2. Supprimer les logs de debug avec patterns
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log.*\(DEBUG\|debug\|Debug\|TRACE\|trace\)/d' {} \;

# 3. Supprimer les logs temporaires
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log.*\(loaded\|Loading\|mounting\|rendering\)/d' {} \;

# 4. Supprimer les console.log avec données sensibles
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log.*\(user.*email\|password\|token\|key\)/d' {} \;

# 5. Supprimer les console.log simples (une ligne) mais garder console.error/warn
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log[^.].*[^{][^}];$/d' {} \;

# 6. Nettoyer les lignes vides multiples
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/^[[:space:]]*$/{N;/^\n$/d;}' {} \;

# 7. Corriger les syntaxes orphelines
echo "🔍 Correction des syntaxes orphelines..."

# Chercher et corriger les objets orphelins
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*:[[:space:]]*[^,}]*,*$/d' {} \;

# Supprimer les }) orphelins
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/^[[:space:]]*});[[:space:]]*$/d' {} \;

# Compter après nettoyage
FINAL_COUNT=$(grep -r "console\." src/ --include="*.tsx" --include="*.ts" | wc -l)
echo "📊 Console statements finaux: $FINAL_COUNT"

REMOVED=$((INITIAL_COUNT - FINAL_COUNT))
echo "✅ Supprimé $REMOVED console statements!"

# Tester la compilation
echo "🔄 Test de compilation..."
if npm run build --silent; then
    echo "✅ Compilation réussie!"
else
    echo "❌ Erreurs de compilation détectées"
    echo "🔄 Restauration depuis la sauvegarde..."
    rm -rf src
    mv src.backup.console.$(date +%Y%m%d_%H%M%S) src
    echo "⚠️  Sauvegarde restaurée"
fi

echo "🎉 Nettoyage console.log terminé!"