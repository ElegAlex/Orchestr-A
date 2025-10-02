const admin = require('firebase-admin');

// Initialiser Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'orchestr-a-3b48e'
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function setAdminClaims() {
  try {
    console.log('🔍 Recherche de l\'utilisateur admin elegalex1980@gmail.com...\n');

    // 1. Trouver l'utilisateur par email dans Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail('elegalex1980@gmail.com');
      console.log(`✅ Utilisateur trouvé dans Firebase Auth:`);
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
      console.log(`   EmailVerified: ${userRecord.emailVerified}`);
      console.log(`   DisplayName: ${userRecord.displayName}`);
    } catch (error) {
      console.error('❌ Utilisateur non trouvé dans Firebase Auth:', error.message);
      return;
    }

    // 2. Définir les custom claims pour admin
    console.log('\n🔧 Application des custom claims admin...');
    
    const customClaims = {
      role: 'admin',
      admin: true,
      permissions: ['*']
    };

    await auth.setCustomUserClaims(userRecord.uid, customClaims);
    console.log('✅ Custom claims appliqués avec succès');

    // 3. Vérifier les claims
    const updatedUser = await auth.getUser(userRecord.uid);
    console.log('\n📋 Custom claims actuels:');
    console.log(JSON.stringify(updatedUser.customClaims, null, 2));

    // 4. Mettre à jour ou créer le document Firestore
    console.log('\n🔧 Mise à jour du document Firestore...');
    
    const userDocRef = db.collection('users').doc(userRecord.uid);
    const userDoc = await userDocRef.get();

    const userData = {
      email: userRecord.email,
      displayName: userRecord.displayName || 'Admin Orchestr\'A',
      firstName: 'Admin',
      lastName: 'Orchestr\'A',
      role: 'admin',
      isActive: true,
      permissions: ['*'],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (!userDoc.exists) {
      userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      userData.login = userRecord.email;
      userData.loginType = 'email';
      console.log('📝 Création du document utilisateur...');
      await userDocRef.set(userData);
    } else {
      console.log('📝 Mise à jour du document utilisateur...');
      await userDocRef.update(userData);
    }

    console.log('✅ Document Firestore mis à jour');

    console.log('\n🎉 SUCCÈS: Configuration admin terminée');
    console.log(`   Email: ${userRecord.email}`);
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`   Rôle: admin`);
    console.log(`   Custom claims: Appliqués`);
    console.log(`   Document Firestore: Synchronisé`);
    
    console.log('\n💡 Action requise:');
    console.log('   → Déconnecte-toi et reconnecte-toi dans l\'application');
    console.log('   → Les nouveaux tokens avec claims admin seront générés');

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Exécuter le script
setAdminClaims().then(() => {
  console.log('\n🏁 Script terminé');
  process.exit(0);
}).catch(console.error);