#!/bin/bash

echo "🧹 Nettoyage sélectif des console.log..."

# Compter les console avant nettoyage
INITIAL_COUNT=$(grep -r "console\." src/ --include="*.tsx" --include="*.ts" | wc -l)
echo "📊 Console statements initiaux: $INITIAL_COUNT"

# Supprimer uniquement les console.log de debug spécifiques
echo "🔧 Suppression des console.log de debug spécifiques..."

# Supprimer les debug logs avec emojis
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log.*[🔍🧹🚀📋🗺️🏷️📦👥📁🔥🔐🏢👤📧❌✅📧🛠️🗑️🎨🔧⚡]/d' {} \;

# Supprimer les logs de debug avec des patterns spécifiques
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log.*\(DEBUG\|debug\|Debug\)/d' {} \;

# Supprimer les logs temporaires du genre "file loaded" ou "component loaded"
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log.*loaded.*at/d' {} \;
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log.*component loaded/d' {} \;

# Supprimer les logs avec des données utilisateur sensibles
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log.*user.*email.*role.*permissions/d' {} \;

# Supprimer les console.log multi-lignes de callback
sed -i '/console\.log.*forEach.*index/,+6d' src/pages/Calendar.tsx

# Garder les console.error dans les catch blocks mais supprimer les autres
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/try\|catch/!s/console\.error.*;//g' {} \;

# Nettoyer les lignes vides multiples créées
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/^[[:space:]]*$/{N;/^\n$/d;}' {} \;

# Compter après nettoyage
FINAL_COUNT=$(grep -r "console\." src/ --include="*.tsx" --include="*.ts" | wc -l)
echo "📊 Console statements finaux: $FINAL_COUNT"

REMOVED=$((INITIAL_COUNT - FINAL_COUNT))
echo "✅ Supprimé $REMOVED console statements!"
echo "🎉 Nettoyage sélectif terminé!"