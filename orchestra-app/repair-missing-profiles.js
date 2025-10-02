const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');
const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = require('firebase/firestore');
const fs = require('fs');

// Configuration Firebase
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

async function repairMissingProfiles() {
  try {
    console.log('🔧 RÉPARATION DES PROFILS FIRESTORE MANQUANTS');
    console.log('='.repeat(60));

    // Lire le fichier d'export des utilisateurs Firebase Auth
    const usersData = JSON.parse(fs.readFileSync('users_dump.json', 'utf8'));
    const authUsers = usersData.users;

    console.log(`📋 ${authUsers.length} utilisateurs trouvés dans Firebase Auth`);

    let created = 0;
    let existing = 0;
    let errors = 0;

    for (const authUser of authUsers) {
      try {
        const { localId, email, displayName } = authUser;

        // Vérifier si le profil Firestore existe
        const userDocRef = doc(db, 'users', localId);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          console.log(`✅ Profil existe déjà: ${email}`);
          existing++;
          continue;
        }

        console.log(`🔧 Création du profil manquant pour: ${email}`);

        // Extraire prénom/nom du displayName
        const nameParts = (displayName || 'Utilisateur Inconnu').split(' ');
        const firstName = nameParts[0] || 'Prénom';
        const lastName = nameParts.slice(1).join(' ') || 'Nom';

        // Déterminer le login et le type de connexion
        let login = '';
        let loginType = 'email';

        if (email.includes('@orchestr-a.internal')) {
          // Utilisateur interne
          login = email.split('@')[0];
          loginType = 'internal';
        }

        // Créer le profil Firestore
        const userProfile = {
          id: localId,
          email: email,
          displayName: displayName || `${firstName} ${lastName}`,
          firstName: firstName,
          lastName: lastName,
          role: 'viewer', // Rôle par défaut sécurisé
          department: '',
          login: login,
          loginType: loginType,
          isActive: true,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          createdBy: 'system_repair'
        };

        await setDoc(userDocRef, userProfile);

        console.log(`✅ Profil créé: ${email} (${firstName} ${lastName})`);
        created++;

      } catch (error) {
        console.error(`❌ Erreur pour ${authUser.email}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 RÉSUMÉ DE LA RÉPARATION:');
    console.log(`✅ Profils créés: ${created}`);
    console.log(`ℹ️  Profils existants: ${existing}`);
    console.log(`❌ Erreurs: ${errors}`);

    if (created > 0) {
      console.log('\n🎉 Réparation terminée avec succès !');
      console.log('Les utilisateurs peuvent maintenant se connecter normalement.');
    }

  } catch (error) {
    console.error('💥 Erreur fatale:', error);
  }
}

repairMissingProfiles();