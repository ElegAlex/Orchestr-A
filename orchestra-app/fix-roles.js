// Script simple pour mettre à jour les rôles utilisateur
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc, where, query } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAY2INRLTXf_jsOocbX0iaJF653sGtApBU",
  authDomain: "orchestr-a.firebaseapp.com",
  projectId: "orchestr-a",
  storageBucket: "orchestr-a.firebasestorage.app",
  messagingSenderId: "991388913696",
  appId: "1:991388913696:web:2cc37a45fbae9871c6ac45"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateUserRoles() {
  try {
    console.log('Mise à jour des rôles utilisateur...');
    
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    let updated = 0;
    
    for (const docSnap of snapshot.docs) {
      const userData = docSnap.data();
      
      if (userData.role !== 'admin') {
        await updateDoc(doc(db, 'users', docSnap.id), {
          role: 'admin'
        });
        console.log(`✅ ${userData.email || docSnap.id}: ${userData.role} → admin`);
        updated++;
      } else {
        console.log(`👤 ${userData.email || docSnap.id}: déjà admin`);
      }
    }
    
    console.log(`\n🎉 ${updated} utilisateur(s) mis à jour`);
    
  } catch (error) {
    console.error('Erreur:', error);
  }
}

updateUserRoles();