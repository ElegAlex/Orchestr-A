const admin = require('firebase-admin');

// Initialiser Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('../service-account-real.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'orchestr-a-3b48e'
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function fixAllUserClaims() {
  try {
    console.log('🔍 Recherche de tous les utilisateurs...\n');

    // Récupérer tous les utilisateurs de Firestore
    const usersSnapshot = await db.collection('users').get();

    console.log(`📊 ${usersSnapshot.size} utilisateurs trouvés dans Firestore\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const uid = userDoc.id;

      try {
        // Vérifier que l'utilisateur existe dans Firebase Auth
        const authUser = await auth.getUser(uid);

        // Déterminer le rôle
        let role = userData.role || 'contributor';

        // Si pas de rôle défini, assigner "manager" pour avoir les permissions nécessaires
        if (!userData.role) {
          role = 'manager';
          console.log(`⚠️  ${userData.email || authUser.email} n'avait pas de rôle, assignation de "manager"`);
        }

        // Définir les custom claims
        const customClaims = {
          role: role,
          permissions: userData.permissions || []
        };

        // Si admin, ajouter le flag
        if (role === 'admin') {
          customClaims.admin = true;
          customClaims.permissions = ['*'];
        }

        await auth.setCustomUserClaims(uid, customClaims);

        // Mettre à jour Firestore si nécessaire
        if (!userData.role || userData.role !== role) {
          await db.collection('users').doc(uid).update({
            role: role,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        console.log(`✅ ${userData.email || authUser.email} → role: ${role}`);
        successCount++;

      } catch (error) {
        console.error(`❌ Erreur pour UID ${uid}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Résumé:');
    console.log(`   ✅ Succès: ${successCount}`);
    console.log(`   ❌ Erreurs: ${errorCount}`);
    console.log('\n💡 Action requise pour les utilisateurs:');
    console.log('   → Déconnexion puis reconnexion dans l\'application');
    console.log('   → Les nouveaux tokens avec claims seront générés');

  } catch (error) {
    console.error('❌ Erreur globale:', error);
  }
}

// Exécuter le script
fixAllUserClaims().then(() => {
  console.log('\n🏁 Script terminé');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
