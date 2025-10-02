#!/bin/bash

echo "🚀 CRÉATION NOUVEAU PROJET ORCHESTR'A AVEC STORAGE GRATUIT"
echo "=========================================================="

# Nouveau nom de projet (doit être unique globalement)
NEW_PROJECT_ID="orchestra-global-$(date +%s)"
echo "🆔 ID du nouveau projet: $NEW_PROJECT_ID"

# Créer le projet Google Cloud dans une région avec Storage gratuit (US)
echo "☁️ Création du projet Google Cloud..."
gcloud projects create $NEW_PROJECT_ID --name="Orchestr'A Global" --set-as-default

if [ $? -ne 0 ]; then
    echo "❌ Échec création projet Google Cloud"
    exit 1
fi

echo "✅ Projet Google Cloud créé: $NEW_PROJECT_ID"

# Activer la facturation (requis pour Firebase)
echo "💳 Activation de la facturation..."
# Note: Cette étape nécessite un compte de facturation configuré
# gcloud billing projects link $NEW_PROJECT_ID --billing-account=BILLING_ACCOUNT_ID

# Ajouter Firebase au projet
echo "🔥 Ajout de Firebase au projet..."
curl -X POST \
  "https://firebase.googleapis.com/v1beta1/projects/$NEW_PROJECT_ID:addFirebase" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json"

if [ $? -eq 0 ]; then
    echo "✅ Firebase ajouté au projet"
else
    echo "⚠️ Firebase peut nécessiter une configuration manuelle"
fi

# Activer les APIs nécessaires
echo "🔧 Activation des APIs Google Cloud..."
gcloud services enable firebase.googleapis.com --project=$NEW_PROJECT_ID
gcloud services enable firestore.googleapis.com --project=$NEW_PROJECT_ID
gcloud services enable cloudfunctions.googleapis.com --project=$NEW_PROJECT_ID
gcloud services enable firebasestorage.googleapis.com --project=$NEW_PROJECT_ID
gcloud services enable storage.googleapis.com --project=$NEW_PROJECT_ID
gcloud services enable cloudbuild.googleapis.com --project=$NEW_PROJECT_ID
gcloud services enable artifactregistry.googleapis.com --project=$NEW_PROJECT_ID

# Créer une app web Firebase
echo "🌐 Création de l'app web Firebase..."
curl -X POST \
  "https://firebase.googleapis.com/v1beta1/projects/$NEW_PROJECT_ID/webApps" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Orchestr'\''A Web App"
  }'

# Mettre à jour la configuration Firebase
echo "📝 Mise à jour de la configuration..."
cat > firebase.json.new << EOF
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "functions": {
    "predeploy": ["npm --prefix \"\\$RESOURCE_DIR\" run build"],
    "source": "functions"
  },
  "hosting": {
    "public": "orchestra-app/build",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
EOF

mv firebase.json.new firebase.json

echo ""
echo "🎯 PROJET CRÉÉ AVEC SUCCÈS !"
echo "=========================="
echo "🆔 Nouveau projet ID: $NEW_PROJECT_ID"
echo "🌐 Console: https://console.firebase.google.com/project/$NEW_PROJECT_ID"
echo "📍 Région: us-central1 (Storage gratuit inclus)"
echo ""
echo "▶️ Prochaine étape: Déploiement automatique de l'infrastructure"
echo "   Commande: ./scripts/auto-deploy.sh $NEW_PROJECT_ID"