const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signOut, connectAuthEmulator } = require('firebase/auth');
const { getFirestore, doc, setDoc, getDoc, connectFirestoreEmulator } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAY2INRLTXf_jsOocbX0iaJF653sGtApBU",
  authDomain: "orchestr-a.firebaseapp.com",
  projectId: "orchestr-a-3b48e",
  storageBucket: "orchestr-a-3b48e.firebasestorage.app",
  messagingSenderId: "991388913696",
  appId: "1:991388913696:web:2cc37a45fbae9871c6ac45",
  measurementId: "G-B58VR5VGT4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Connexion aux emulators
connectAuthEmulator(auth, "http://localhost:9099");
connectFirestoreEmulator(db, "localhost", 8080);

async function syncUsersWithAuth() {
  console.log('🔄 Synchronisation des utilisateurs Auth et Firestore...');

  const testUsers = [
    {
      email: 'admin@orchestra-demo.com',
      password: 'admin123',
      userData: {
        email: 'admin@orchestra-demo.com',
        displayName: 'Admin Orchestra',
        firstName: 'Admin',
        lastName: 'Orchestra',
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      }
    },
    {
      email: 'manager@orchestra-demo.com',
      password: 'manager123',
      userData: {
        email: 'manager@orchestra-demo.com',
        displayName: 'Marie Dupont',
        firstName: 'Marie',
        lastName: 'Dupont',
        role: 'manager',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      }
    },
    {
      email: 'dev@orchestra-demo.com',
      password: 'dev123',
      userData: {
        email: 'dev@orchestra-demo.com',
        displayName: 'Jean Martin',
        firstName: 'Jean',
        lastName: 'Martin',
        role: 'contributor',
        isActive: true,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      }
    }
  ];

  try {
    for (const user of testUsers) {
      try {
        // Créer le compte Auth
        const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
        const authUser = userCredential.user;

        console.log(`✅ Compte Auth créé: ${user.email} | UID: ${authUser.uid}`);

        // Créer/Mettre à jour le document utilisateur dans Firestore avec le bon UID
        await setDoc(doc(db, 'users', authUser.uid), {
          id: authUser.uid,
          ...user.userData
        });

        console.log(`✅ Document Firestore créé pour: ${user.email}`);

        // Se déconnecter pour le prochain utilisateur
        await signOut(auth);

      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`⚠️  Compte existant: ${user.email}`);
        } else {
          console.error(`❌ Erreur pour ${user.email}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Synchronisation terminée !');
    console.log('\n📋 IDENTIFIANTS DE CONNEXION:');
    console.log('================================');
    testUsers.forEach(user => {
      console.log(`👤 ${user.userData.displayName}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Mot de passe: ${user.password}`);
      console.log(`   Rôle: ${user.userData.role}`);
      console.log('');
    });
    console.log('🌐 URL de test: http://localhost:3000');

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Exécuter le script
syncUsersWithAuth().then(() => {
  console.log('✅ Script terminé');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});