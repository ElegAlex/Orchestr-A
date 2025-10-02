const admin = require('firebase-admin');
const { execSync } = require('child_process');

// Initialiser Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'orchestr-a-3b48e',
  storageBucket: 'orchestr-a-3b48e.firebasestorage.app'
});

async function checkDeploymentStatus() {
  console.log('🔍 Vérification du déploiement Firebase - Orchestr\'A\n');
  
  const status = {
    firestore: '❌',
    functions: '❌',
    storage: '❌',
    hosting: '❌',
    services: '❌'
  };
  
  try {
    // 1. Vérifier Firestore
    console.log('📊 Vérification Firestore...');
    const db = admin.firestore();
    
    // Tester une écriture/lecture
    const testDoc = db.collection('_test').doc('deployment-check');
    await testDoc.set({ timestamp: new Date(), test: true });
    const testRead = await testDoc.get();
    if (testRead.exists) {
      status.firestore = '✅';
      console.log('   ✅ Firestore: Opérationnel (lecture/écriture OK)');
      await testDoc.delete(); // Nettoyer
    }
    
    // Vérifier les index
    try {
      const indexesOutput = execSync('firebase firestore:indexes --project orchestr-a-3b48e', { encoding: 'utf8' });
      const indexes = JSON.parse(indexesOutput).indexes;
      console.log(`   📋 ${indexes.length} index Firestore configurés`);
    } catch (e) {
      console.log('   ⚠️ Impossible de vérifier les index');
    }
    
  } catch (error) {
    console.log('   ❌ Firestore: Erreur -', error.message);
  }
  
  try {
    // 2. Vérifier Cloud Functions
    console.log('\n⚡ Vérification Cloud Functions...');
    const functionsOutput = execSync('firebase functions:list --project orchestr-a-3b48e', { encoding: 'utf8' });
    
    const expectedFunctions = [
      'onProjectCreated',
      'onTaskAssigned', 
      'checkDeadlines',
      'webhook',
      'generateReport',
      'cleanupOldData',
      'exportData'
    ];
    
    let deployedCount = 0;
    expectedFunctions.forEach(func => {
      if (functionsOutput.includes(func)) {
        deployedCount++;
        console.log(`   ✅ ${func}: Déployé`);
      } else {
        console.log(`   ❌ ${func}: Manquant`);
      }
    });
    
    if (deployedCount === expectedFunctions.length) {
      status.functions = '✅';
      console.log(`   📊 Toutes les fonctions (${deployedCount}/${expectedFunctions.length}) sont déployées`);
    } else {
      console.log(`   ⚠️ Seulement ${deployedCount}/${expectedFunctions.length} fonctions déployées`);
    }
    
  } catch (error) {
    console.log('   ❌ Cloud Functions: Erreur -', error.message);
  }
  
  try {
    // 3. Vérifier Storage
    console.log('\n🗄️ Vérification Firebase Storage...');
    const storage = admin.storage();
    const bucket = storage.bucket();
    
    // Test d'existence du bucket
    const [exists] = await bucket.exists();
    if (exists) {
      console.log('   ✅ Bucket Firebase Storage existe');
      
      // Test d'écriture
      const testFile = bucket.file('_test/deployment-check.txt');
      await testFile.save('Test de déploiement - ' + new Date().toISOString());
      console.log('   ✅ Écriture dans Storage: OK');
      
      // Nettoyer
      await testFile.delete();
      
      status.storage = '✅';
    } else {
      console.log('   ⚠️ Bucket Firebase Storage n\'existe pas encore');
      console.log('   💡 Activez manuellement Storage dans la console: https://console.firebase.google.com/project/orchestr-a/storage');
    }
    
  } catch (error) {
    console.log('   ⚠️ Storage: Non configuré -', error.message);
  }
  
  try {
    // 4. Vérifier configuration Hosting
    console.log('\n🌐 Vérification Hosting...');
    const fs = require('fs');
    if (fs.existsSync('./firebase.json')) {
      const firebaseConfig = JSON.parse(fs.readFileSync('./firebase.json', 'utf8'));
      if (firebaseConfig.hosting) {
        console.log('   ✅ Configuration Hosting: OK');
        console.log(`   📁 Public: ${firebaseConfig.hosting.public}`);
        status.hosting = '✅';
      }
    } else {
      console.log('   ❌ firebase.json manquant');
    }
    
  } catch (error) {
    console.log('   ❌ Hosting: Erreur -', error.message);
  }
  
  // 5. Vérifier les services développés
  console.log('\n🛠️ Services développés pour Orchestr\'A:');
  const services = [
    'permissions.service.ts - Gestion des rôles et permissions',
    'session.service.ts - Gestion des sessions utilisateur', 
    'document.service.ts - Upload/download de fichiers',
    'analytics.service.ts - Métriques et analyses',
    'webhook.service.ts - Intégrations externes'
  ];
  
  const fs = require('fs');
  const servicesPath = './orchestra-app/src/services/';
  let servicesCount = 0;
  
  services.forEach(service => {
    const fileName = service.split(' - ')[0];
    const servicePath = servicesPath + fileName;
    if (fs.existsSync(servicePath)) {
      console.log(`   ✅ ${service}`);
      servicesCount++;
    } else {
      console.log(`   ❌ ${service}`);
    }
  });
  
  if (servicesCount === services.length) {
    status.services = '✅';
  }
  
  // Résumé final
  console.log('\n' + '='.repeat(60));
  console.log('📋 RÉSUMÉ DU DÉPLOIEMENT ORCHESTR\'A');
  console.log('='.repeat(60));
  console.log(`🔥 Firestore (Base de données): ${status.firestore}`);
  console.log(`⚡ Cloud Functions (7 fonctions): ${status.functions}`);
  console.log(`🗄️ Firebase Storage: ${status.storage}`);
  console.log(`🌐 Hosting (Configuration): ${status.hosting}`);
  console.log(`🛠️ Services métier (5 services): ${status.services}`);
  
  const allGreen = Object.values(status).every(s => s === '✅');
  
  if (allGreen) {
    console.log('\n🎉 DÉPLOIEMENT COMPLET ET OPÉRATIONNEL !');
    console.log('🚀 Orchestr\'A est prêt pour la production');
  } else {
    console.log('\n⚠️ Déploiement partiel - Quelques éléments à finaliser');
  }
  
  console.log('\n🔗 Liens utiles:');
  console.log('- Console Firebase: https://console.firebase.google.com/project/orchestr-a-3b48e');
  console.log('- Functions: https://console.firebase.google.com/project/orchestr-a-3b48e/functions');
  console.log('- Firestore: https://console.firebase.google.com/project/orchestr-a-3b48e/firestore');
  console.log('- Storage: https://console.firebase.google.com/project/orchestr-a-3b48e/storage');
  
  process.exit(allGreen ? 0 : 1);
}

checkDeploymentStatus().catch(console.error);