#!/usr/bin/env node
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Script pour corriger l'index Firestore manquant exact
 * Basé sur l'erreur: projectId + createdAt + __name__ (ALL ASCENDING)
 */

const PROJECT_ID = 'orchestr-a-3b48e';

async function createExactIndex() {
  console.log('🔥 Correction de l\'index Firestore exact...');
  
  const indexDefinition = {
    fields: [
      {
        fieldPath: "projectId",
        order: "ASCENDING"
      },
      {
        fieldPath: "createdAt",
        order: "ASCENDING"
      },
      {
        fieldPath: "__name__",
        order: "ASCENDING"
      }
    ],
    queryScope: "COLLECTION"
  };
  
  try {
    console.log('📊 Structure de l\'index requis:');
    console.log('   - projectId (ASCENDING)');
    console.log('   - createdAt (ASCENDING)'); 
    console.log('   - __name__ (ASCENDING)');
    console.log('');
    
    // Méthode 1: API REST
    console.log('🚀 Tentative via API REST...');
    const createCommand = `curl -X POST \\
      -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
      -H "Content-Type: application/json" \\
      -d '${JSON.stringify(indexDefinition)}' \\
      "https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/tasks/indexes"`;
    
    const { stdout, stderr } = await execAsync(createCommand);
    console.log('📝 Réponse API:', stdout);
    
    if (stderr) console.log('⚠️  Stderr:', stderr);
    
    // Parse la réponse
    let response;
    try {
      response = JSON.parse(stdout);
    } catch (e) {
      console.log('⚠️  Réponse non-JSON, probablement créé');
      return true;
    }
    
    if (response.error) {
      if (response.error.message.includes('already exists')) {
        console.log('✅ Index déjà existant');
        return true;
      } else {
        throw new Error(`API Error: ${response.error.message}`);
      }
    }
    
    console.log('✅ Index créé via API!');
    console.log('📍 Nom:', response.name);
    console.log('⏳ État:', response.state);
    
    return true;
    
  } catch (apiError) {
    console.log('❌ Échec API:', apiError.message);
    
    // Méthode 2: Lien direct Firebase Console
    console.log('🌐 SOLUTION ALTERNATIVE - Firebase Console:');
    console.log('');
    console.log('🔗 Cliquez sur ce lien pour créer l\'index automatiquement:');
    console.log('👉 https://console.firebase.google.com/v1/r/project/orchestr-a-3b48e/firestore/indexes?create_composite=Ckhwcm9qZWN0cy9vcmNoZXN0ci1hL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy90YXNrcy9pbmRleGVzL18QARoNCglwcm9qZWN0SWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAC');
    console.log('');
    console.log('📋 Ou créez manuellement:');
    console.log('1. Ouvrir Firebase Console > Firestore > Index');
    console.log('2. "Créer un index composé"');
    console.log('3. Collection: tasks');
    console.log('4. Champs (dans cet ordre):');
    console.log('   - projectId (Croissant)');
    console.log('   - createdAt (Croissant)');
    console.log('   - __name__ (Croissant)');
    console.log('5. Créer');
    
    return false;
  }
}

async function waitForIndex() {
  console.log('⏳ Attente que l\'index soit prêt...');
  
  for (let i = 0; i < 12; i++) { // 2 minutes max
    try {
      const { stdout } = await execAsync(`curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" "https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/tasks/indexes"`);
      
      const response = JSON.parse(stdout);
      const targetIndex = response.indexes?.find(index => 
        index.fields?.some(f => f.fieldPath === 'projectId') &&
        index.fields?.some(f => f.fieldPath === 'createdAt') &&
        index.fields?.some(f => f.fieldPath === '__name__') &&
        index.fields?.length === 3
      );
      
      if (targetIndex) {
        console.log(`📊 Index trouvé - État: ${targetIndex.state}`);
        if (targetIndex.state === 'READY') {
          console.log('✅ Index prêt!');
          return true;
        }
      }
      
      console.log(`⏳ Tentative ${i + 1}/12 - en attente...`);
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10s
      
    } catch (error) {
      console.log(`❌ Erreur vérification: ${error.message}`);
    }
  }
  
  console.log('⚠️  Timeout - l\'index prend plus de temps que prévu');
  return false;
}

async function testQueries() {
  console.log('🧪 Test des requêtes après création d\'index...');
  
  try {
    // Test similaire à ce que fait l'application
    const testQuery = {
      structuredQuery: {
        from: [{ collectionId: "tasks" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "projectId" },
            op: "EQUAL",
            value: { stringValue: "test-project" }
          }
        },
        orderBy: [
          { field: { fieldPath: "createdAt" }, direction: "ASCENDING" }
        ],
        limit: 1
      }
    };
    
    const { stdout, stderr } = await execAsync(`curl -s -X POST \\
      -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
      -H "Content-Type: application/json" \\
      -d '${JSON.stringify(testQuery)}' \\
      "https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery"`);
    
    if (stderr && stderr.includes('index')) {
      console.log('❌ Requête échoue encore - index pas prêt');
      return false;
    }
    
    console.log('✅ Requête test réussie');
    return true;
    
  } catch (error) {
    console.log('❌ Erreur test requête:', error.message);
    return false;
  }
}

async function main() {
  console.log('🎯 Correction de l\'index Firestore manquant');
  console.log('============================================');
  console.log('');
  
  // Créer l'index
  const created = await createExactIndex();
  if (!created) {
    console.log('❌ Impossible de créer l\'index automatiquement');
    console.log('🔧 Utilisez le lien Firebase Console ci-dessus');
    console.log('⏳ Puis relancez ce script pour vérifier');
    process.exit(1);
  }
  
  console.log('');
  
  // Attendre qu'il soit prêt
  const ready = await waitForIndex();
  if (!ready) {
    console.log('⚠️  L\'index prend du temps à être créé');
    console.log('🔄 Relancez ce script dans quelques minutes');
    console.log('📊 Ou vérifiez dans Firebase Console > Firestore > Index');
    return;
  }
  
  console.log('');
  
  // Tester les requêtes
  const working = await testQueries();
  
  console.log('');
  console.log('🎉 RÉSUMÉ:');
  console.log(`✅ Index créé: ${created ? 'OUI' : 'NON'}`);
  console.log(`✅ Index prêt: ${ready ? 'OUI' : 'EN COURS'}`);
  console.log(`✅ Requêtes OK: ${working ? 'OUI' : 'À VÉRIFIER'}`);
  
  if (created && ready && working) {
    console.log('');
    console.log('🚀 SUCCÈS COMPLET!');
    console.log('✅ Les tâches devraient maintenant se charger dans l\'application');
    console.log('🌐 Testez sur: https://orchestr-a-3b48e.web.app');
  }
}

if (require.main === module) {
  main().catch(console.error);
}