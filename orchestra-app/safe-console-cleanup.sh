#!/bin/bash

echo "🧹 Nettoyage sécurisé des console.log..."

# Compter les console avant nettoyage
INITIAL_COUNT=$(grep -r "console\.log" src/ --include="*.tsx" --include="*.ts" | wc -l)
echo "📊 Console.log statements initiaux: $INITIAL_COUNT"

# Créer une sauvegarde
echo "💾 Création d'une sauvegarde..."
cp -r src src.backup.safe.$(date +%Y%m%d_%H%M%S)

# Seulement supprimer les console.log qui contiennent des mots-clés de debug
echo "🔧 Suppression sélective des console.log de debug..."

# Supprimer uniquement les console.log avec des emojis de debug
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log.*[🔍🧹🚀📋🗺️🏷️📦👥📁🔥🔐🏢👤📧❌✅🛠️🗑️🎨🔧⚡]/d' {} \;

# Supprimer les console.log avec "DEBUG", "debug", "Debug", etc.
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log.*[Dd][Ee][Bb][Uu][Gg]/d' {} \;

# Supprimer les console.log temporaires communs
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/console\.log.*\(component loaded\|file loaded\|mounting\|rendering\)/d' {} \;

# Nettoyer les lignes vides multiples
find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '/^[[:space:]]*$/{N;/^\n$/d;}' {} \;

# Compter après nettoyage
FINAL_COUNT=$(grep -r "console\.log" src/ --include="*.tsx" --include="*.ts" | wc -l)
echo "📊 Console.log statements finaux: $FINAL_COUNT"

REMOVED=$((INITIAL_COUNT - FINAL_COUNT))
echo "✅ Supprimé $REMOVED console.log statements!"

echo "🔄 Test de compilation..."
if npm run build --silent >/dev/null 2>&1; then
    echo "✅ Compilation réussie!"
    echo "✅ Console.log cleanup terminé avec succès!"
else
    echo "❌ Erreurs de compilation détectées"
    echo "🔄 Restauration depuis la sauvegarde..."
    LATEST_BACKUP=$(ls -1t src.backup.safe.* | head -1)
    rm -rf src
    mv "$LATEST_BACKUP" src
    echo "⚠️  Sauvegarde restaurée"
fi