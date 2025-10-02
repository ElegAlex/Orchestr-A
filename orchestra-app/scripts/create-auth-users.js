const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signOut } = require('firebase/auth');
const { connectAuthEmulator } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyAY2INRLTXf_jsOocbX0iaJF653sGtApBU",
  authDomain: "orchestr-a.firebaseapp.com",
  projectId: "orchestr-a-3b48e",
  storageBucket: "orchestr-a.firebasestorage.app",
  messagingSenderId: "991388913696",
  appId: "1:991388913696:web:2cc37a45fbae9871c6ac45",
  measurementId: "G-B58VR5VGT4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Connexion aux emulators
connectAuthEmulator(auth, "http://localhost:9099");

async function createAuthUsers() {
  console.log('🔐 Création des comptes Firebase Auth de test...');

  const testUsers = [
    {
      email: 'admin@orchestra-demo.com',
      password: 'admin123',
      displayName: 'Admin Orchestra',
      role: 'admin'
    },
    {
      email: 'manager@orchestra-demo.com',
      password: 'manager123',
      displayName: 'Marie Dupont',
      role: 'manager'
    },
    {
      email: 'dev@orchestra-demo.com',
      password: 'dev123',
      displayName: 'Jean Martin',
      role: 'contributor'
    }
  ];

  try {
    for (const user of testUsers) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
        console.log(`✅ Compte créé: ${user.email} | Mot de passe: ${user.password}`);

        // Se déconnecter pour créer le compte suivant
        await signOut(auth);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`⚠️  Compte déjà existant: ${user.email} | Mot de passe: ${user.password}`);
        } else {
          console.error(`❌ Erreur pour ${user.email}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Comptes de test créés avec succès !');
    console.log('\n📋 IDENTIFIANTS DE CONNEXION:');
    console.log('================================');
    testUsers.forEach(user => {
      console.log(`👤 ${user.displayName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Mot de passe: ${user.password}`);
      console.log(`   Rôle: ${user.role}`);
      console.log('');
    });
    console.log('🌐 URL de test: http://localhost:3000');

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Exécuter le script
createAuthUsers().then(() => {
  console.log('✅ Script terminé');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});