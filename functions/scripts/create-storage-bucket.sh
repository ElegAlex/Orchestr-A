#!/bin/bash

echo "🚀 Création du bucket Firebase Storage..."

# Obtenir le token d'accès
ACCESS_TOKEN=$(gcloud auth application-default print-access-token)

# Créer le bucket via l'API REST Firebase
curl -X POST \
  "https://firebasestorage.googleapis.com/v1beta/projects/orchestr-a/buckets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "orchestr-a.firebasestorage.app"
  }'

echo "✅ Bucket créé avec succès !"

# Initialiser Storage dans le projet Firebase
curl -X POST \
  "https://firebase.googleapis.com/v1beta1/projects/orchestr-a:addFirebase" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"

echo "✅ Firebase Storage initialisé !"