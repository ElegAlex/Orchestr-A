import * as admin from 'firebase-admin';
import { https, logger } from 'firebase-functions/v1';

export const repairUserIds = https.onCall(async (data, context) => {
  try {
    // Vérifier les permissions
    if (!context.auth) {
      throw new https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const db = admin.firestore();
    const batch = db.batch();
    let updateCount = 0;

    // Mapping des IDs orphelins vers les bons IDs utilisateurs
    const idMapping: { [key: string]: string } = {
      // IDs orphelins identifiés dans les logs
      '8enATiteabbVlFcB7dGNtpBHdWF2': 'jOtgkbDdFfYdY4ytb0rAg3PKASW2', // Lahbib Chahlal
      'mX9ycCV1mta4g6DQ2D7KjsjejAe2': 'GhH3JGV0ZCbXLyOfKwI8iGkkkL33', // Probablement Alexandre BERGE
    };

    logger.info('🔧 Début de la réparation des IDs utilisateurs dans les tâches RACI');

    // Récupérer toutes les tâches
    const tasksSnapshot = await db.collection('tasks').get();

    for (const doc of tasksSnapshot.docs) {
      const task = doc.data();
      let hasUpdates = false;
      const updates: any = {};

      // Vérifier et corriger chaque champ RACI
      const raciFields = ['responsible', 'accountable', 'consulted', 'informed'];

      for (const field of raciFields) {
        if (Array.isArray(task[field])) {
          const updatedArray = task[field].map((id: string) => {
            if (idMapping[id]) {
              logger.info(`📋 Remplacement dans ${doc.id}.${field}: ${id} → ${idMapping[id]}`);
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
        logger.info(`📋 Remplacement dans ${doc.id}.createdBy: ${task.createdBy} → ${idMapping[task.createdBy]}`);
        updates.createdBy = idMapping[task.createdBy];
        hasUpdates = true;
      }

      // Appliquer les mises à jour
      if (hasUpdates) {
        batch.update(doc.ref, updates);
        updateCount++;
        logger.info(`✅ Tâche "${task.title}" mise à jour`);
      }
    }

    // Committer toutes les modifications
    if (updateCount > 0) {
      await batch.commit();
      logger.info(`🎉 ${updateCount} tâches mises à jour avec succès`);
    } else {
      logger.info('ℹ️ Aucune tâche à mettre à jour');
    }

    return {
      success: true,
      updatedTasks: updateCount,
      message: `${updateCount} tâches ont été mises à jour`
    };

  } catch (error) {
    logger.error('❌ Erreur lors de la réparation des IDs:', error);
    throw new https.HttpsError('internal', 'Erreur lors de la réparation des IDs utilisateurs');
  }
});