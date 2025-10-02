const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs, updateDoc, query, where } = require('firebase/firestore');

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAY2INRLTXf_jsOocbX0iaJF653sGtApBU",
  authDomain: "orchestr-a-3b48e.firebaseapp.com",
  projectId: "orchestr-a-3b48e",
  storageBucket: "orchestr-a-3b48e.firebasestorage.app",
  messagingSenderId: "991388913696",
  appId: "1:991388913696:web:2cc37a45fbae9871c6ac45",
  measurementId: "G-B58VR5VGT4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkAdminUser() {
  try {
    console.log('🔍 Vérification du profil admin elegalex1980@gmail.com...\n');

    // 1. Chercher l'utilisateur par email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', 'elegalex1980@gmail.com'));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('❌ PROBLÈME: Aucun utilisateur trouvé avec l\'email elegalex1980@gmail.com');
      return;
    }

    console.log(`📊 Trouvé ${querySnapshot.size} utilisateur(s) avec cet email\n`);

    querySnapshot.docs.forEach((doc, index) => {
      const userData = doc.data();
      console.log(`👤 Utilisateur ${index + 1}:`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Email: ${userData.email}`);
      console.log(`   Nom: ${userData.firstName} ${userData.lastName}`);
      console.log(`   DisplayName: ${userData.displayName}`);
      console.log(`   Rôle: ${userData.role}`);
      console.log(`   Actif: ${userData.isActive}`);
      console.log(`   Créé le: ${userData.createdAt?.toDate ? userData.createdAt.toDate() : userData.createdAt}`);
      console.log(`   Login: ${userData.login || 'Non défini'}`);
      console.log(`   Type login: ${userData.loginType || 'email'}\n`);
    });

    // 2. Vérifier tous les utilisateurs pour détecter les doublons
    console.log('🔍 Vérification de tous les utilisateurs pour détecter les doublons...\n');
    
    const allUsersSnapshot = await getDocs(collection(db, 'users'));
    const users = allUsersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📊 Total utilisateurs dans la base: ${users.length}\n`);

    // Grouper par email pour détecter les doublons
    const usersByEmail = {};
    users.forEach(user => {
      if (!usersByEmail[user.email]) {
        usersByEmail[user.email] = [];
      }
      usersByEmail[user.email].push(user);
    });

    // Afficher les doublons
    let hasDoubles = false;
    Object.keys(usersByEmail).forEach(email => {
      if (usersByEmail[email].length > 1) {
        hasDoubles = true;
        console.log(`🔄 DOUBLON détecté pour ${email}:`);
        usersByEmail[email].forEach((user, index) => {
          console.log(`   ${index + 1}. ID: ${user.id}, Rôle: ${user.role}, Créé: ${user.createdAt?.toDate ? user.createdAt.toDate() : user.createdAt}`);
        });
        console.log('');
      }
    });

    if (!hasDoubles) {
      console.log('✅ Aucun doublon détecté\n');
    }

    // 3. Si l'admin n'a pas le bon rôle, le corriger
    const adminUser = querySnapshot.docs[0];
    const adminData = adminUser.data();

    if (adminData.role !== 'admin') {
      console.log(`⚠️  Le rôle actuel est "${adminData.role}", correction en "admin"...`);
      
      await updateDoc(doc(db, 'users', adminUser.id), {
        role: 'admin',
        updatedAt: new Date()
      });
      
      console.log('✅ Rôle corrigé en "admin"');
    } else {
      console.log('✅ Le rôle "admin" est correct');
    }

    console.log('\n🎯 RÉSUMÉ:');
    console.log(`   Email: ${adminData.email}`);
    console.log(`   Rôle: admin (corrigé si nécessaire)`);
    console.log(`   Statut: ${adminData.isActive ? 'Actif' : 'Inactif'}`);
    console.log(`   Accès admin: OUI\n`);

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  }
}

// Exécuter le script
checkAdminUser().then(() => {
  console.log('🏁 Vérification terminée');
  process.exit(0);
}).catch(console.error);