const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyDM4x12OPV7YgzWSCYW-JOo8P0FjcegMr0",
  authDomain: "orchestr-a-3b48e.firebaseapp.com",
  projectId: "orchestr-a-3b48e",
  storageBucket: "orchestr-a-3b48e.firebasestorage.app",
  messagingSenderId: "727625651545",
  appId: "1:727625651545:web:bcfec2aff94934c73f6848"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findLoginMismatches() {
  try {
    console.log('🔍 DÉTECTION DES INCOHÉRENCES LOGIN <-> EMAIL');
    console.log('='.repeat(60));

    // Lire les utilisateurs Firebase Auth
    const authUsers = JSON.parse(fs.readFileSync('users_dump.json', 'utf8')).users;

    // Lire tous les profils Firestore
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const firestoreUsers = [];

    snapshot.forEach(doc => {
      firestoreUsers.push({ id: doc.id, ...doc.data() });
    });

    console.log(`📋 ${authUsers.length} utilisateurs Firebase Auth`);
    console.log(`📋 ${firestoreUsers.length} profils Firestore`);

    let mismatches = [];

    for (const firestoreUser of firestoreUsers) {
      const { id: firestoreId, email, login, loginType } = firestoreUser;

      if (loginType !== 'internal' || !login) continue;

      // Chercher l'utilisateur Firebase Auth correspondant
      const authUser = authUsers.find(au => au.localId === firestoreId);
      if (!authUser) continue;

      // Vérifier la cohérence email <-> login
      const expectedEmail = `${login}@orchestr-a.internal`;
      const actualAuthEmail = authUser.email;

      if (expectedEmail !== actualAuthEmail) {
        mismatches.push({
          firestoreId,
          displayName: firestoreUser.displayName || firestoreUser.firstName + ' ' + firestoreUser.lastName,
          login,
          expectedEmail,
          actualAuthEmail,
          firestoreEmail: email
        });
      }
    }

    console.log(`\n🔍 INCOHÉRENCES TROUVÉES: ${mismatches.length}\n`);

    for (const mismatch of mismatches) {
      console.log(`❌ ${mismatch.displayName}`);
      console.log(`   Login Firestore: ${mismatch.login}`);
      console.log(`   Email attendu: ${mismatch.expectedEmail}`);
      console.log(`   Email Firebase Auth: ${mismatch.actualAuthEmail}`);
      console.log(`   → L'utilisateur ne peut pas se connecter !`);
      console.log('');
    }

    if (mismatches.length > 0) {
      console.log('🔧 SOLUTION:');
      console.log('   Ces utilisateurs ont des logins modifiés qui ne correspondent plus');
      console.log('   à leur email Firebase Auth. Utilise la fonction de réinitialisation');
      console.log('   de mot de passe admin pour créer de nouveaux comptes Firebase Auth');
      console.log('   ou demande-leur de se connecter avec leur ancien login.');
    } else {
      console.log('✅ Aucune incohérence trouvée !');
    }

  } catch (error) {
    console.error('💥 Erreur:', error);
  }
}

findLoginMismatches();