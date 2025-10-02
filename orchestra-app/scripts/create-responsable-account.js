const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

// Initialiser Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'orchestr-a-3b48e'
  });
}

const auth = getAuth();
const db = getFirestore();

async function createResponsableAccount() {
  try {
    console.log('🎯 Création du compte RESPONSABLE...\n');

    // Informations du compte responsable
    const responsableData = {
      email: 'eleg.alex@orchestr-a.fr', // Ton nouvel email métier
      password: 'ResponsableOrchestra2024!', // Mot de passe temporaire
      displayName: 'Alex Responsable',
      firstName: 'Alex',
      lastName: 'Responsable',
      role: 'responsable',
      isActive: true,
      permissions: [], // Utilise les permissions du rôle
      department: null,
      serviceIds: [], // Pas de service pour le responsable (vue d'ensemble)
      login: 'eleg.alex@orchestr-a.fr',
      loginType: 'email'
    };

    console.log('📝 Création du compte Firebase Auth...');
    
    // 1. Créer l'utilisateur dans Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: responsableData.email,
        password: responsableData.password,
        displayName: responsableData.displayName,
        emailVerified: true
      });
      console.log(`✅ Utilisateur créé dans Firebase Auth: ${userRecord.uid}`);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log('ℹ️  L\'email existe déjà, récupération du compte...');
        userRecord = await auth.getUserByEmail(responsableData.email);
      } else {
        throw error;
      }
    }

    // 2. Définir les custom claims
    console.log('🔧 Application des custom claims responsable...');
    const customClaims = {
      role: 'responsable',
      permissions: ['*'] // Toutes les permissions sauf admin.* 
    };

    await auth.setCustomUserClaims(userRecord.uid, customClaims);
    console.log('✅ Custom claims appliqués');

    // 3. Créer/Mettre à jour le document Firestore
    console.log('💾 Création du document utilisateur Firestore...');
    
    const userDocRef = db.collection('users').doc(userRecord.uid);
    const firestoreData = {
      ...responsableData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await userDocRef.set(firestoreData);
    console.log('✅ Document Firestore créé');

    console.log('\n🎉 COMPTE RESPONSABLE CRÉÉ AVEC SUCCÈS !');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${responsableData.email}`);
    console.log(`🔑 Mot de passe: ${responsableData.password}`);
    console.log(`👤 UID: ${userRecord.uid}`);
    console.log(`🏆 Rôle: RESPONSABLE GÉNÉRAL`);
    console.log(`✨ Permissions: TOUTES (sauf admin technique)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 ACCÈS COMPLET À :');
    console.log('   ✅ Tous les projets');
    console.log('   ✅ Toutes les tâches'); 
    console.log('   ✅ Tous les utilisateurs');
    console.log('   ✅ Tous les départements');
    console.log('   ✅ Tous les services');
    console.log('   ✅ RH Administration');
    console.log('   ✅ Rapports et analytics');
    console.log('   ✅ Settings et affectations');
    console.log('   ❌ Administration technique (Firebase, logs, webhooks)');
    
    console.log('\n🔐 CONNEXION :');
    console.log('   1. Va sur https://orchestr-a-3b48e.web.app');
    console.log(`   2. Connecte-toi avec ${responsableData.email}`);
    console.log(`   3. Mot de passe: ${responsableData.password}`);
    console.log('   4. Change le mot de passe après première connexion');

  } catch (error) {
    console.error('❌ Erreur lors de la création du compte responsable:', error);
  }
}

// Exécuter le script
createResponsableAccount().then(() => {
  console.log('\n🏁 Script terminé');
  process.exit(0);
}).catch(console.error);