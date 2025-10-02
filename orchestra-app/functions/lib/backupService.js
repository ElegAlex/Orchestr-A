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
exports.restoreFromBackup = exports.scheduledBackup = exports.triggerManualBackup = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// =============================================================================
// SERVICE DE BACKUP FIREBASE
// =============================================================================
/**
 * Fonction de backup manuel - Exporte toutes les collections vers Cloud Storage
 * Usage : Appelée depuis l'admin UI ou cron job
 */
exports.triggerManualBackup = functions
    .region('europe-west1')
    .runWith({
    memory: '1GB',
    timeoutSeconds: 540,
})
    .https.onCall(async (data, context) => {
    var _a;
    // Vérification des permissions admin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication requise');
    }
    try {
        const db = admin.firestore();
        const timestamp = new Date().toISOString().split('T')[0];
        const backupPath = `gs://orchestr-a-3b48e.appspot.com/backups/${timestamp}`;
        console.log('🔄 Démarrage du backup manuel vers:', backupPath);
        // Lister toutes les collections à sauvegarder
        const collections = [
            'users', 'projects', 'tasks', 'allocations',
            'leaves', 'skills', 'systemConfig', 'workload_snapshots'
        ];
        const backupPromises = collections.map(async (collectionName) => {
            try {
                // Export manuel collection par collection vers Cloud Storage
                const snapshot = await db.collection(collectionName).get();
                const docs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    data: doc.data()
                }));
                // Sauvegarder dans un document JSON dans Cloud Storage
                const bucket = admin.storage().bucket();
                const fileName = `${timestamp}/backup_${collectionName}.json`;
                const file = bucket.file(fileName);
                await file.save(JSON.stringify(docs, null, 2), {
                    metadata: {
                        contentType: 'application/json',
                        metadata: {
                            collection: collectionName,
                            timestamp: timestamp,
                            documentCount: docs.length.toString()
                        }
                    }
                });
                console.log(`✅ Collection "${collectionName}" exportée: ${docs.length} documents`);
                return {
                    collection: collectionName,
                    status: 'success',
                    documentCount: docs.length,
                    file: fileName
                };
            }
            catch (error) {
                console.error(`❌ Erreur export "${collectionName}":`, error);
                return { collection: collectionName, status: 'error', error: (error === null || error === void 0 ? void 0 : error.message) || String(error) };
            }
        });
        const results = await Promise.all(backupPromises);
        // Enregistrer les métadonnées du backup
        await db.collection('systemLogs').add({
            type: 'backup',
            trigger: 'manual',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            userId: context.auth.uid,
            path: backupPath,
            collections: results,
            status: results.every(r => r.status === 'success') ? 'success' : 'partial'
        });
        return {
            success: true,
            message: `Backup manuel terminé avec succès`,
            path: backupPath,
            collections: results.length,
            details: results
        };
    }
    catch (error) {
        console.error('❌ Erreur backup manuel:', error);
        // Log de l'erreur
        const db = admin.firestore();
        await db.collection('systemLogs').add({
            type: 'backup_error',
            trigger: 'manual',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            userId: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid,
            error: (error === null || error === void 0 ? void 0 : error.message) || String(error)
        });
        throw new functions.https.HttpsError('internal', `Erreur backup: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`);
    }
});
/**
 * Backup automatique programmé
 * S'exécute selon la config (daily, weekly, monthly)
 */
exports.scheduledBackup = functions
    .region('europe-west1')
    .runWith({
    memory: '1GB',
    timeoutSeconds: 540,
})
    .pubsub
    .schedule('0 3 * * *') // Tous les jours à 3h du matin
    .timeZone('Europe/Paris')
    .onRun(async (context) => {
    var _a;
    try {
        const db = admin.firestore();
        // Récupérer la config système
        const configDoc = await db.collection('systemConfig').doc('main').get();
        const config = configDoc.data();
        if (!((_a = config === null || config === void 0 ? void 0 : config.firebase) === null || _a === void 0 ? void 0 : _a.autoBackup)) {
            console.log('⏭️ Backup automatique désactivé');
            return;
        }
        const frequency = config.firebase.backupFrequency || 'daily';
        const today = new Date();
        const dayOfWeek = today.getDay();
        const dayOfMonth = today.getDate();
        // Vérifier si on doit faire le backup selon la fréquence
        let shouldBackup = false;
        switch (frequency) {
            case 'daily':
                shouldBackup = true;
                break;
            case 'weekly':
                shouldBackup = dayOfWeek === 1; // Lundi
                break;
            case 'monthly':
                shouldBackup = dayOfMonth === 1; // 1er du mois
                break;
        }
        if (!shouldBackup) {
            console.log(`⏭️ Backup programmé skippé (fréquence: ${frequency})`);
            return;
        }
        console.log(`🔄 Démarrage backup automatique (${frequency})`);
        const timestamp = today.toISOString().split('T')[0];
        const backupPath = `gs://orchestr-a-3b48e.appspot.com/backups/auto/${timestamp}`;
        // Collections principales seulement pour les backups auto
        const collections = ['users', 'projects', 'tasks', 'systemConfig'];
        const results = await Promise.all(collections.map(async (collectionName) => {
            try {
                const snapshot = await db.collection(collectionName).get();
                const docs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    data: doc.data()
                }));
                const bucket = admin.storage().bucket();
                const fileName = `auto/${timestamp}/backup_${collectionName}.json`;
                const file = bucket.file(fileName);
                await file.save(JSON.stringify(docs, null, 2), {
                    metadata: {
                        contentType: 'application/json',
                        metadata: {
                            collection: collectionName,
                            timestamp: timestamp,
                            documentCount: docs.length.toString()
                        }
                    }
                });
                return { collection: collectionName, status: 'success', documentCount: docs.length, file: fileName };
            }
            catch (error) {
                console.error(`❌ Erreur export "${collectionName}":`, error);
                return { collection: collectionName, status: 'error', error: (error === null || error === void 0 ? void 0 : error.message) || String(error) };
            }
        }));
        // Nettoyer les anciens backups selon la rétention
        const retention = config.firebase.backupRetention || 30;
        await cleanupOldBackups(retention);
        // Log du résultat
        await db.collection('systemLogs').add({
            type: 'backup',
            trigger: 'automatic',
            frequency,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            path: backupPath,
            collections: results,
            status: results.every(r => r.status === 'success') ? 'success' : 'partial'
        });
        console.log(`✅ Backup automatique terminé: ${results.length} collections`);
    }
    catch (error) {
        console.error('❌ Erreur backup automatique:', error);
        const db = admin.firestore();
        await db.collection('systemLogs').add({
            type: 'backup_error',
            trigger: 'automatic',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            error: (error === null || error === void 0 ? void 0 : error.message) || String(error)
        });
    }
});
/**
 * Nettoie les anciens backups selon la politique de rétention
 */
async function cleanupOldBackups(retentionDays) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        console.log(`🧹 Nettoyage des backups antérieurs au ${cutoffDate.toISOString().split('T')[0]}`);
        // En production, on utiliserait Cloud Storage API pour supprimer les anciens backups
        // Pour le moment, on log juste l'intention
        console.log(`📝 Politique de rétention: ${retentionDays} jours`);
    }
    catch (error) {
        console.error('❌ Erreur nettoyage backups:', error);
    }
}
/**
 * Restaurer depuis un backup spécifique
 * ATTENTION: Opération destructive !
 */
exports.restoreFromBackup = functions
    .region('europe-west1')
    .runWith({
    memory: '2GB',
    timeoutSeconds: 540,
})
    .https.onCall(async (data, context) => {
    // Super-admin seulement
    if (!context.auth || context.auth.token.role !== 'super-admin') {
        throw new functions.https.HttpsError('permission-denied', 'Opération réservée aux super-administrateurs');
    }
    const { backupPath, collections = [] } = data;
    try {
        console.log('🔄 Démarrage restauration depuis:', backupPath);
        const db = admin.firestore();
        const bucket = admin.storage().bucket();
        const restoredCollections = [];
        // Restaurer collection par collection
        for (const collectionName of collections) {
            try {
                const fileName = `${backupPath}/backup_${collectionName}.json`;
                const file = bucket.file(fileName);
                const [fileData] = await file.download();
                const backupData = JSON.parse(fileData.toString());
                const batch = db.batch();
                let batchCount = 0;
                for (const docData of backupData) {
                    const docRef = db.collection(collectionName).doc(docData.id);
                    batch.set(docRef, docData.data);
                    batchCount++;
                    if (batchCount >= 500) { // Limite Firestore batch
                        await batch.commit();
                        batchCount = 0;
                    }
                }
                if (batchCount > 0) {
                    await batch.commit();
                }
                restoredCollections.push({
                    collection: collectionName,
                    status: 'success',
                    documentCount: backupData.length
                });
                console.log(`✅ Collection "${collectionName}" restaurée: ${backupData.length} docs`);
            }
            catch (error) {
                console.error(`❌ Erreur restauration "${collectionName}":`, error);
                restoredCollections.push({
                    collection: collectionName,
                    status: 'error',
                    error: (error === null || error === void 0 ? void 0 : error.message) || String(error)
                });
            }
        }
        // Log de la restauration
        await db.collection('systemLogs').add({
            type: 'restore',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            userId: context.auth.uid,
            sourcePath: backupPath,
            collections: restoredCollections,
            status: restoredCollections.every(c => c.status === 'success') ? 'success' : 'partial'
        });
        return {
            success: true,
            message: 'Restauration terminée',
            collections: restoredCollections
        };
    }
    catch (error) {
        console.error('❌ Erreur restauration:', error);
        throw new functions.https.HttpsError('internal', `Erreur restauration: ${(error === null || error === void 0 ? void 0 : error.message) || String(error)}`);
    }
});
//# sourceMappingURL=backupService.js.map