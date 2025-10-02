#!/bin/bash

# Script pour déployer les règles Storage Firebase

echo "🔥 Déploiement des règles Firebase Storage..."

# Utiliser l'API REST Firebase pour déployer les règles
PROJECT_ID="orchestr-a-3b48e"
ACCESS_TOKEN=$(firebase auth:print-access-token)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Erreur: Impossible d'obtenir le token d'accès Firebase"
    echo "Exécutez: firebase login"
    exit 1
fi

echo "✅ Token d'accès obtenu"

# Lire le fichier de règles
RULES_CONTENT=$(cat storage.rules)

# Créer le payload JSON
PAYLOAD=$(cat <<EOF
{
  "source": {
    "files": [
      {
        "content": $(echo "$RULES_CONTENT" | jq -R -s .),
        "name": "storage.rules"
      }
    ]
  }
}
EOF
)

echo "📤 Envoi des règles à Firebase..."

# Déployer les règles via l'API REST
RESPONSE=$(curl -s -X POST \
  "https://firebaserules.googleapis.com/v1/projects/$PROJECT_ID/rulesets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "📥 Réponse: $RESPONSE"

# Extraire l'ID du ruleset
RULESET_NAME=$(echo "$RESPONSE" | jq -r '.name // empty')

if [ -z "$RULESET_NAME" ]; then
    echo "❌ Erreur lors de la création du ruleset"
    echo "$RESPONSE"
    exit 1
fi

echo "✅ Ruleset créé: $RULESET_NAME"

# Publier le ruleset
echo "📋 Publication du ruleset..."

RELEASE_PAYLOAD=$(cat <<EOF
{
  "name": "projects/$PROJECT_ID/releases/firebase.storage/$PROJECT_ID.firebasestorage.app",
  "rulesetName": "$RULESET_NAME"
}
EOF
)

RELEASE_RESPONSE=$(curl -s -X PATCH \
  "https://firebaserules.googleapis.com/v1/projects/$PROJECT_ID/releases/firebase.storage/$PROJECT_ID.firebasestorage.app" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$RELEASE_PAYLOAD")

echo "📥 Réponse publication: $RELEASE_RESPONSE"

echo "🎉 Règles Storage déployées avec succès!"