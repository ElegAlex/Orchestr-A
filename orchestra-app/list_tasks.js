const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDM4x12OPV7YgzWSCYW-JOo8P0FjcegMr0",
  authDomain: "orchestr-a-3b48e.firebaseapp.com",
  projectId: "orchestr-a-3b48e",
  storageBucket: "orchestr-a-3b48e.firebasestorage.app",
  messagingSenderId: "727625651545",
  appId: "1:727625651545:web:5a6d49c3c85a81fb2f0e29"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listTasks() {
  const snapshot = await getDocs(collection(db, 'simpleTasks'));
  
  console.log('\n📋 TOTAL: ' + snapshot.size + ' tâches simples\n');
  
  let count = 1;
  snapshot.forEach((doc) => {
    const d = doc.data();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('#' + count);
    console.log('ID: ' + doc.id);
    console.log('Titre: ' + d.title);
    console.log('Horaires: ' + (d.startTime || 'N/A') + ' - ' + (d.endTime || 'N/A'));
    console.log('Priorité: ' + d.priority + ' | Statut: ' + d.status);
    count++;
  });
  
  process.exit(0);
}

listTasks().catch(e => {
  console.error(e);
  process.exit(1);
});
