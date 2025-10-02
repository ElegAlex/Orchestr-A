#!/usr/bin/env node
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Script pour créer l'index Firestore manquant pour les tâches
 * Index requis: projectId (ASC) + createdAt (ASC)
 */

const PROJECT_ID = 'orchestr-a';
const COLLECTION_GROUP = 'tasks';

async function createFirestoreIndex() {
  console.log('🔥 Création de l\'index Firestore pour les tâches...');
  
  try {
    // Vérifier que gcloud est installé et configuré
    console.log('📋 Vérification de gcloud...');
    await execAsync('gcloud --version');
    
    // Vérifier le projet actuel
    const { stdout: currentProject } = await execAsync('gcloud config get-value project');
    if (currentProject.trim() !== PROJECT_ID) {
      console.log(`🔧 Configuration du projet ${PROJECT_ID}...`);
      await execAsync(`gcloud config set project ${PROJECT_ID}`);
    }
    
    console.log('✅ Configuration gcloud OK');
    
    // Créer l'index via l'API REST de Firestore
    console.log('📊 Création de l\'index via l\'API Firestore...');
    
    const indexDefinition = {
      fields: [
        {
          fieldPath: "projectId",
          order: "ASCENDING"
        },
        {
          fieldPath: "createdAt", 
          order: "ASCENDING"
        }
      ],
      queryScope: "COLLECTION"
    };
    
    const createIndexCommand = `curl -X POST \\
      -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
      -H "Content-Type: application/json" \\
      -d '${JSON.stringify(indexDefinition)}' \\
      "https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/${COLLECTION_GROUP}/indexes"`;
    
    console.log('🚀 Exécution de la requête de création d\'index...');
    const { stdout, stderr } = await execAsync(createIndexCommand);
    
    if (stderr && !stderr.includes('already exists')) {
      console.error('❌ Erreur lors de la création:', stderr);
    }
    
    // Parser la réponse
    let response;
    try {
      response = JSON.parse(stdout);
    } catch (e) {
      console.log('📝 Réponse brute:', stdout);
      throw new Error('Impossible de parser la réponse JSON');
    }
    
    if (response.error) {
      if (response.error.message.includes('already exists') || 
          response.error.message.includes('not necessary')) {
        console.log('✅ Index déjà existant ou pas nécessaire');
        return true;
      }
      throw new Error(`Erreur API: ${response.error.message}`);
    }
    
    console.log('✅ Index créé avec succès!');
    console.log('📍 Nom de l\'index:', response.name);
    console.log('⏳ État:', response.state);
    
    if (response.state === 'CREATING') {
      console.log('⏱️  L\'index est en cours de création... (2-5 minutes)');
      console.log('🔄 Vous pouvez vérifier le statut dans Firebase Console');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    
    // Fallback: utiliser Firebase CLI si possible
    console.log('🔄 Tentative de fallback avec Firebase CLI...');
    try {
      await execAsync('firebase --version');
      
      // Créer un fichier d'index temporaire
      const tempIndexContent = {
        indexes: [
          {
            collectionGroup: COLLECTION_GROUP,
            queryScope: "COLLECTION", 
            fields: [
              {
                fieldPath: "projectId",
                order: "ASCENDING"
              },
              {
                fieldPath: "createdAt",
                order: "ASCENDING"
              }
            ]
          }
        ],
        fieldOverrides: []
      };
      
      const fs = require('fs');
      const tempFile = '/tmp/firestore-index-temp.json';
      fs.writeFileSync(tempFile, JSON.stringify(tempIndexContent, null, 2));
      
      console.log('📄 Fichier d\'index temporaire créé');
      await execAsync(`firebase firestore:indexes:create ${tempFile} --project ${PROJECT_ID}`);
      
      // Nettoyer
      fs.unlinkSync(tempFile);
      console.log('✅ Index créé via Firebase CLI');
      return true;
      
    } catch (cliError) {
      console.error('❌ Échec du fallback Firebase CLI:', cliError.message);
      
      // Dernière option: instructions manuelles
      console.log('\n🔧 SOLUTION MANUELLE:');
      console.log('1. Ouvrez Firebase Console: https://console.firebase.google.com/project/orchestr-a/firestore/indexes');
      console.log('2. Cliquez sur "Créer un index composé"');
      console.log('3. Collection: tasks');
      console.log('4. Champs:');
      console.log('   - projectId (Croissant)');
      console.log('   - createdAt (Croissant)');
      console.log('5. Cliquez sur "Créer"');
      
      return false;
    }
  }
}

// Fonction pour vérifier le statut de l'index
async function checkIndexStatus() {
  try {
    console.log('🔍 Vérification du statut des index...');
    const { stdout } = await execAsync(`curl -H "Authorization: Bearer $(gcloud auth print-access-token)" "https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/${COLLECTION_GROUP}/indexes"`);
    
    const response = JSON.parse(stdout);
    if (response.indexes) {
      console.log('📊 Index existants pour les tâches:');
      response.indexes.forEach((index, i) => {
        console.log(`   ${i + 1}. ${index.fields.map(f => `${f.fieldPath}(${f.order || f.arrayConfig})`).join(' + ')}`);
        console.log(`      État: ${index.state}`);
      });
    }
  } catch (error) {
    console.log('⚠️  Impossible de vérifier les index existants:', error.message);
  }
}

// Exécution principale
async function main() {
  console.log('🎯 Script de création d\'index Firestore');
  console.log(`📍 Projet: ${PROJECT_ID}`);
  console.log(`📂 Collection: ${COLLECTION_GROUP}`);
  console.log('');
  
  await checkIndexStatus();
  console.log('');
  
  const success = await createFirestoreIndex();
  
  if (success) {
    console.log('\n🎉 Index créé avec succès!');
    console.log('⏳ Attendez 2-5 minutes que l\'index soit prêt');
    console.log('✅ Les tâches devraient maintenant se charger correctement');
  } else {
    console.log('\n❌ Échec de la création automatique');
    console.log('🔧 Veuillez créer l\'index manuellement via Firebase Console');
    process.exit(1);
  }
}

// Gestion des erreurs non capturées
process.on('unhandledRejection', (error) => {
  console.error('❌ Erreur non gérée:', error);
  process.exit(1);
});

if (require.main === module) {
  main();
}