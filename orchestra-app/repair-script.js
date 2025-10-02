const admin = require('firebase-admin');
const serviceAccount = require('./firebase-key.json'); // Tu devras créer ce fichier

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function repairUserIds() {
  try {
    console.log('🔧 Début de la réparation des IDs utilisateurs...');

    // Mapping des IDs orphelins → nouveaux IDs
    const idMapping = {
      // ID orphelin → ID Lahbib
      '8enATiteabbVlFcB7dGNtpBHdWF2': 'jOtgkbDdFfYdY4ytb0rAg3PKASW2',
      // ID créateur orphelin → ID Alexandre (supposé être le créateur)
      'mX9ycCV1mta4g6DQ2D7KjsjejAe2': 'GhH3JGV0ZCbXLyOfKwI8iGkkkL33'
    };

    const batch = db.batch();
    let updateCount = 0;

    // Récupérer toutes les tâches
    const tasksSnapshot = await db.collection('tasks').get();
    console.log(`📋 ${tasksSnapshot.docs.length} tâches à analyser`);

    for (const doc of tasksSnapshot.docs) {
      const task = doc.data();
      let hasUpdates = false;
      const updates = {};

      // Vérifier et corriger les champs RACI
      const raciFields = ['responsible', 'accountable', 'consulted', 'informed'];

      for (const field of raciFields) {
        if (Array.isArray(task[field])) {
          const updatedArray = task[field].map(id => {
            if (idMapping[id]) {
              console.log(`🔄 ${doc.id}.${field}: ${id} → ${idMapping[id]}`);
              hasUpdates = true;
              return idMapping[id];
            }
            return id;
          });

          if (hasUpdates) {
            updates[field] = updatedArray;
          }
        }
      }

      // Vérifier createdBy
      if (task.createdBy && idMapping[task.createdBy]) {
        console.log(`🔄 ${doc.id}.createdBy: ${task.createdBy} → ${idMapping[task.createdBy]}`);
        updates.createdBy = idMapping[task.createdBy];
        hasUpdates = true;
      }

      // Appliquer les mises à jour
      if (hasUpdates) {
        batch.update(doc.ref, updates);
        updateCount++;
        console.log(`✅ Tâche "${task.title}" programmée pour mise à jour`);
      }
    }

    // Committer les modifications
    if (updateCount > 0) {
      await batch.commit();
      console.log(`🎉 ${updateCount} tâches mises à jour avec succès !`);
    } else {
      console.log('ℹ️ Aucune tâche à mettre à jour');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    process.exit();
  }
}

repairUserIds();