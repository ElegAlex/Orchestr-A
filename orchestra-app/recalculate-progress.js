// Script pour recalculer le progress de tous les projets
// Utilise le service project qui a été corrigé pour exclure les sous-tâches

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDM4x12OPV7YgzWSCYW-JOo8P0FjcegMr0",
  authDomain: "orchestr-a-3b48e.firebaseapp.com",
  projectId: "orchestr-a-3b48e",
  storageBucket: "orchestr-a-3b48e.firebasestorage.app",
  messagingSenderId: "727625651545",
  appId: "1:727625651545:web:8de485e7b1ca6b2faa7dc8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function recalculateAllProjects() {
  try {
    console.log('🔄 Début du recalcul des progress...');

    const projectsSnapshot = await getDocs(collection(db, 'projects'));
    console.log(`📊 ${projectsSnapshot.size} projets trouvés`);

    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id;
      const projectData = projectDoc.data();

      console.log(`\n🔍 Projet: ${projectData.name} (${projectId})`);

      // Récupérer toutes les tâches du projet
      const tasksSnapshot = await getDocs(collection(db, 'tasks'));
      const projectTasks = tasksSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(task => task.projectId === projectId);

      console.log(`   📝 ${projectTasks.length} tâches totales`);

      // Filtrer les tâches maîtres uniquement (sans parentTaskId)
      const masterTasks = projectTasks.filter(task => !task.parentTaskId);
      console.log(`   ✅ ${masterTasks.length} tâches maîtres`);

      if (masterTasks.length === 0) {
        console.log(`   ⏭️  Aucune tâche maître, skip`);
        continue;
      }

      let totalStoryPoints = 0;
      let completedStoryPoints = 0;
      let totalMasterTasks = 0;
      let completedMasterTasks = 0;

      masterTasks.forEach(task => {
        totalMasterTasks++;
        const storyPoints = task.storyPoints || 1;
        totalStoryPoints += storyPoints;

        if (task.status === 'DONE') {
          completedMasterTasks++;
          completedStoryPoints += storyPoints;
        }
      });

      const progress = totalStoryPoints > 0
        ? Math.round((completedStoryPoints / totalStoryPoints) * 100)
        : Math.round((completedMasterTasks / totalMasterTasks) * 100);

      console.log(`   📈 Ancien progress: ${projectData.progress || 0}%`);
      console.log(`   📈 Nouveau progress: ${progress}%`);
      console.log(`   📊 Tâches complétées: ${completedMasterTasks}/${totalMasterTasks}`);
      console.log(`   📊 Story points: ${completedStoryPoints}/${totalStoryPoints}`);

      // Mettre à jour le projet
      const { updateDoc, doc } = require('firebase/firestore');
      await updateDoc(doc(db, 'projects', projectId), { progress });

      console.log(`   ✅ Progress mis à jour avec succès`);
    }

    console.log('\n🎉 Recalcul terminé avec succès!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

recalculateAllProjects();
