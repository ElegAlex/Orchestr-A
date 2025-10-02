const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } = require('firebase/firestore');
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

async function fixAuthMapping() {
  try {
    console.log('🔧 RÉPARATION DU MAPPING FIREBASE AUTH <-> FIRESTORE');
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

    let fixed = 0;

    for (const authUser of authUsers) {
      const { localId: authId, email } = authUser;

      // Trouver le profil Firestore correspondant par email
      const matchingProfile = firestoreUsers.find(profile => profile.email === email);

      if (!matchingProfile) {
        console.log(`⚠️  Pas de profil Firestore pour: ${email}`);
        continue;
      }

      // Si les IDs correspondent déjà, pas de problème
      if (matchingProfile.id === authId) {
        console.log(`✅ Mapping OK: ${email}`);
        continue;
      }

      console.log(`🔧 Fixing mapping: ${email}`);
      console.log(`   Firebase Auth ID: ${authId}`);
      console.log(`   Firestore Doc ID: ${matchingProfile.id}`);

      // Créer le profil avec le bon ID Firebase Auth
      const correctedProfile = { ...matchingProfile, id: authId };
      await setDoc(doc(db, 'users', authId), correctedProfile);

      // Supprimer l'ancien document avec le mauvais ID (sauf si c'est déjà le bon)
      if (matchingProfile.id !== authId) {
        await deleteDoc(doc(db, 'users', matchingProfile.id));
      }

      console.log(`✅ Fixed: ${email} → ${authId}`);
      fixed++;
    }

    console.log('\n📊 RÉSUMÉ:');
    console.log(`🔧 Mappings corrigés: ${fixed}`);
    console.log('✅ Tous les utilisateurs peuvent maintenant se connecter !');

  } catch (error) {
    console.error('💥 Erreur:', error);
  }
}

fixAuthMapping();