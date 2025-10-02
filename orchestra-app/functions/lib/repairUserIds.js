"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.repairUserIds = void 0;
const admin = __importStar(require("firebase-admin"));
const v1_1 = require("firebase-functions/v1");
exports.repairUserIds = v1_1.https.onCall(async (data, context) => {
    try {
        // Vérifier les permissions
        if (!context.auth) {
            throw new v1_1.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const db = admin.firestore();
        const batch = db.batch();
        let updateCount = 0;
        // Mapping des IDs orphelins vers les bons IDs utilisateurs
        const idMapping = {
            // IDs orphelins identifiés dans les logs
            '8enATiteabbVlFcB7dGNtpBHdWF2': 'jOtgkbDdFfYdY4ytb0rAg3PKASW2',
            'mX9ycCV1mta4g6DQ2D7KjsjejAe2': 'GhH3JGV0ZCbXLyOfKwI8iGkkkL33', // Probablement Alexandre BERGE
        };
        v1_1.logger.info('🔧 Début de la réparation des IDs utilisateurs dans les tâches RACI');
        // Récupérer toutes les tâches
        const tasksSnapshot = await db.collection('tasks').get();
        for (const doc of tasksSnapshot.docs) {
            const task = doc.data();
            let hasUpdates = false;
            const updates = {};
            // Vérifier et corriger chaque champ RACI
            const raciFields = ['responsible', 'accountable', 'consulted', 'informed'];
            for (const field of raciFields) {
                if (Array.isArray(task[field])) {
                    const updatedArray = task[field].map((id) => {
                        if (idMapping[id]) {
                            v1_1.logger.info(`📋 Remplacement dans ${doc.id}.${field}: ${id} → ${idMapping[id]}`);
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
                v1_1.logger.info(`📋 Remplacement dans ${doc.id}.createdBy: ${task.createdBy} → ${idMapping[task.createdBy]}`);
                updates.createdBy = idMapping[task.createdBy];
                hasUpdates = true;
            }
            // Appliquer les mises à jour
            if (hasUpdates) {
                batch.update(doc.ref, updates);
                updateCount++;
                v1_1.logger.info(`✅ Tâche "${task.title}" mise à jour`);
            }
        }
        // Committer toutes les modifications
        if (updateCount > 0) {
            await batch.commit();
            v1_1.logger.info(`🎉 ${updateCount} tâches mises à jour avec succès`);
        }
        else {
            v1_1.logger.info('ℹ️ Aucune tâche à mettre à jour');
        }
        return {
            success: true,
            updatedTasks: updateCount,
            message: `${updateCount} tâches ont été mises à jour`
        };
    }
    catch (error) {
        v1_1.logger.error('❌ Erreur lors de la réparation des IDs:', error);
        throw new v1_1.https.HttpsError('internal', 'Erreur lors de la réparation des IDs utilisateurs');
    }
});
//# sourceMappingURL=repairUserIds.js.map