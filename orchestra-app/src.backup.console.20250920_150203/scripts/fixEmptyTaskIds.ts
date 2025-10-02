import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

async function fixEmptyTaskIds() {

  try {
    // Récupérer toutes les tâches
    const tasksSnapshot = await getDocs(collection(db, 'tasks'));

    const tasksToFix: any[] = [];
    const duplicateCodes = new Map<string, string[]>();

    // Identifier les tâches problématiques
    tasksSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const docId = docSnap.id;

      // Vérifier les tâches avec des problèmes
      if (!data.id || data.id === '' || data.id !== docId) {
        tasksToFix.push({
          docId,
          data,
          problem: !data.id ? 'no_id' : (data.id === '' ? 'empty_id' : 'mismatch_id')
        });
      }

      // Tracker les codes dupliqués
      if (data.code) {
        if (!duplicateCodes.has(data.code)) {
          duplicateCodes.set(data.code, []);
        }
        const existing = duplicateCodes.get(data.code) || [];
        duplicateCodes.set(data.code, [...existing, docId]);
      }
    });
    // Afficher les problèmes détectés
    if (tasksToFix.length > 0) {
      console.log('\n📝 Détails des tâches problématiques:');
      tasksToFix.forEach(task => {
        console.log(`  - Doc ID: ${task.docId}`);
        console.log(`    Problème: ${task.problem}`);
        console.log(`    ID actuel: "${task.data.id}"`);
        console.log(`    Titre: ${task.data.title || 'Sans titre'}`);
        console.log(`    Code: ${task.data.code}`);
      });

      // Corriger les tâches

      const batch = writeBatch(db);
      let fixedCount = 0;

      for (const task of tasksToFix) {
        const taskRef = doc(db, 'tasks', task.docId);

        // Mettre à jour avec l'ID correct
        batch.update(taskRef, {
          id: task.docId,
          updatedAt: new Date()
        });

        fixedCount++;
        console.log(`  ✓ Correction de ${task.data.code || task.docId}`);
      }

      // Commit des corrections
      await batch.commit();
    } else {
    }

    // Afficher les codes dupliqués s'il y en a
    const duplicates = Array.from(duplicateCodes.entries()).filter(([code, ids]) => ids.length > 1);
    if (duplicates.length > 0) {
      duplicates.forEach(([code, ids]) => {
        console.log(`  Code "${code}" utilisé ${ids.length} fois`);
      });
    }

    return {
      fixed: tasksToFix.length,
      duplicateCodes: duplicates
    };

  } catch (error) {
    
    throw error;
  }
}

// Export pour utilisation
export default fixEmptyTaskIds;

// Si exécuté directement
if (require.main === module) {
  fixEmptyTaskIds().then(result => {
    console.log('\n🎉 Script terminé');
    process.exit(0);
  }).catch(error => {
    
    process.exit(1);
  });
}