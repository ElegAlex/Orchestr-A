#!/bin/bash

# Script pour supprimer tous les console.log, console.warn, console.info, console.debug, console.error du code
# Garde uniquement console.error dans les blocs catch

echo "🧹 Nettoyage des console.log dans le code..."

# Compteur initial
INITIAL_COUNT=$(grep -r "console\." src/ --include="*.tsx" --include="*.ts" | wc -l)
echo "📊 Nombre initial de console statements: $INITIAL_COUNT"

# Créer une sauvegarde
echo "💾 Création d'une sauvegarde..."
cp -r src/ src.backup.$(date +%Y%m%d_%H%M%S)/

# Supprimer les console.log, console.warn, console.info, console.debug simples
echo "🔧 Suppression des console.log, warn, info, debug..."
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/^[[:space:]]*console\.\(log\|warn\|info\|debug\)/d' {} \;

# Supprimer les console.log multi-lignes (avec des objets)
echo "🔧 Suppression des console.log multi-lignes..."
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec perl -i -0pe 's/console\.(log|warn|info|debug)\([^;]*?\);?\s*\n//gs' {} \;

# Garder console.error uniquement dans les catch blocks, mais les commenter
echo "🔧 Commentaire des console.error (sauf dans les catch)..."
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/{/,/catch/!s/console\.error/\/\/ console.error/g' {} \;

# Nettoyer les lignes vides multiples créées
echo "🔧 Nettoyage des lignes vides multiples..."
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/^$/N;/^\n$/d' {} \;

# Compteur final
FINAL_COUNT=$(grep -r "console\." src/ --include="*.tsx" --include="*.ts" | wc -l)
echo "📊 Nombre final de console statements: $FINAL_COUNT"

REMOVED=$((INITIAL_COUNT - FINAL_COUNT))
echo "✅ Supprimé $REMOVED console statements!"
echo "🎉 Nettoyage terminé!"