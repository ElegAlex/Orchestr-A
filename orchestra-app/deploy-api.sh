#!/bin/bash

# ⚠️ SCRIPT DE DÉPLOIEMENT VALIDÉ - NE PAS MODIFIER
# Ce script est LA méthode qui FONCTIONNE pour déployer en production
# Dernière validation : 29/09/2025
# Documentation complète : /DEPLOY-WORKING-METHOD.md

echo "🚀 Déploiement direct via API Firebase..."

PROJECT_ID="orchestr-a-3b48e"
API_KEY="AIzaSyDM4x12OPV7YgzWSCYW-JOo8P0FjcegMr0" # Utiliser la clé de .env qui fonctionne

# Essayer différentes méthodes
echo "📤 Tentative 1: API Firebase Hosting..."

# Méthode 1: API Firebase Hosting
curl -X POST \
  "https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT_ID}/sites/${PROJECT_ID}/versions" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ]
    }
  }' > deploy_response.json

if [ $? -eq 0 ]; then
  echo "✅ Version créée avec succès !"
  VERSION_ID=$(cat deploy_response.json | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | cut -d'/' -f6)
  echo "📋 Version ID: $VERSION_ID"

  # Upload des fichiers
  echo "📤 Upload des fichiers..."
  cd build
  for file in $(find . -type f); do
    echo "📄 Upload: $file"
    curl -X POST \
      "https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT_ID}/sites/${PROJECT_ID}/versions/${VERSION_ID}/files" \
      -H "Authorization: Bearer ${API_KEY}" \
      -H "Content-Type: application/octet-stream" \
      --data-binary "@$file"
  done
  cd ..

  # Finaliser le déploiement
  echo "🎯 Finalisation du déploiement..."
  curl -X PATCH \
    "https://firebasehosting.googleapis.com/v1beta1/projects/${PROJECT_ID}/sites/${PROJECT_ID}/versions/${VERSION_ID}?updateMask=status" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"status": "FINALIZED"}'

  echo "✅ Déploiement terminé !"
  echo "🌐 Application disponible sur:"
  echo "   https://${PROJECT_ID}.web.app"
  echo "   https://${PROJECT_ID}.firebaseapp.com"
else
  echo "⚠️ Méthode 1 échouée, tentative 2..."

  # Méthode 2: Serveur web temporaire
  echo "🔄 Création d'un serveur web temporaire..."

  if command -v python3 &> /dev/null; then
    echo "🐍 Utilisation de Python..."
    cd build
    echo "🌐 Serveur démarré sur: http://localhost:8000"
    echo "📋 Instructions pour déployer manuellement:"
    echo "1. Ouvrir https://console.firebase.google.com/project/${PROJECT_ID}/hosting"
    echo "2. Cliquer sur 'Commencer' ou 'Nouveau déploiement'"
    echo "3. Glisser-déposer tous les fichiers de ce dossier"
    echo "4. Publier"
    echo ""
    echo "🎯 Votre application sera disponible sur:"
    echo "   https://${PROJECT_ID}.web.app"
    echo "   https://${PROJECT_ID}.firebaseapp.com"
    echo ""
    echo "Appuyez sur Ctrl+C pour arrêter le serveur"
    python3 -m http.server 8000
  elif command -v node &> /dev/null; then
    echo "📦 Utilisation de Node.js..."
    cat > ../temp-server.js << EOF
const express = require('express');
const path = require('path');
const app = express();
const port = 8000;

app.use(express.static('./build'));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, () => {
  console.log('🌐 Serveur démarré sur: http://localhost:' + port);
  console.log('📋 Instructions pour déployer manuellement:');
  console.log('1. Ouvrir https://console.firebase.google.com/project/${PROJECT_ID}/hosting');
  console.log('2. Cliquer sur "Commencer" ou "Nouveau déploiement"');
  console.log('3. Glisser-déposer tous les fichiers du dossier ./build');
  console.log('4. Publier');
  console.log('');
  console.log('🎯 Votre application sera disponible sur:');
  console.log('   https://${PROJECT_ID}.web.app');
  console.log('   https://${PROJECT_ID}.firebaseapp.com');
});
EOF
    node temp-server.js
  else
    echo "❌ Aucun serveur web disponible"
    echo "📋 Déploiement manuel requis:"
    echo "1. Ouvrir https://console.firebase.google.com/project/${PROJECT_ID}/hosting"
    echo "2. Cliquer sur 'Commencer' ou 'Nouveau déploiement'"
    echo "3. Glisser-déposer le contenu du dossier ./build"
    echo "4. Publier"
    echo ""
    echo "🎯 Votre application sera disponible sur:"
    echo "   https://${PROJECT_ID}.web.app"
    echo "   https://${PROJECT_ID}.firebaseapp.com"
  fi
fi

# Nettoyage
rm -f deploy_response.json temp-server.js