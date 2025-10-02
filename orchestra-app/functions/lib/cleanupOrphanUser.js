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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOrphanUser = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
// Initialize admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}
const corsOptions = {
    origin: [
        'https://orchestr-a-3b48e.web.app',
        'https://orchestr-a-3b48e.firebaseapp.com',
        'http://localhost:3000'
    ],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'OPTIONS']
};
const corsHandler = (0, cors_1.default)(corsOptions);
exports.cleanupOrphanUser = functions
    .region('us-central1')
    .https.onRequest(async (req, res) => {
    return corsHandler(req, res, async () => {
        var _a;
        try {
            if (req.method !== 'POST') {
                res.status(405).send({ error: 'Method not allowed' });
                return;
            }
            // Verify Firebase token
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).send({ error: 'Unauthorized' });
                return;
            }
            const token = authHeader.split('Bearer ')[1];
            let decodedToken;
            try {
                decodedToken = await admin.auth().verifyIdToken(token);
            }
            catch (error) {
                res.status(401).send({ error: 'Invalid token' });
                return;
            }
            // Check admin permissions
            const adminUser = await admin.firestore()
                .collection('users')
                .doc(decodedToken.uid)
                .get();
            if (!adminUser.exists || ((_a = adminUser.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
                res.status(403).send({ error: 'Admin access required' });
                return;
            }
            const { orphanUserId } = req.body;
            if (!orphanUserId) {
                res.status(400).send({ error: 'orphanUserId required' });
                return;
            }
            console.log(`🧹 NETTOYAGE: Suppression de l'utilisateur orphelin ${orphanUserId}`);
            // Vérifier que l'utilisateur existe dans Auth
            let authUser;
            try {
                authUser = await admin.auth().getUser(orphanUserId);
                console.log(`Utilisateur trouvé dans Auth: ${authUser.email}`);
            }
            catch (error) {
                if (error.code === 'auth/user-not-found') {
                    res.status(404).send({ error: 'Utilisateur non trouvé dans Auth' });
                    return;
                }
                throw error;
            }
            // Vérifier s'il existe dans Firestore
            const firestoreUser = await admin.firestore()
                .collection('users')
                .doc(orphanUserId)
                .get();
            if (firestoreUser.exists) {
                console.log(`⚠️ Utilisateur existe aussi dans Firestore - suppression des deux`);
                // Supprimer de Firestore
                await admin.firestore()
                    .collection('users')
                    .doc(orphanUserId)
                    .delete();
            }
            else {
                console.log(`✅ Utilisateur orphelin confirmé - existe dans Auth mais pas Firestore`);
            }
            // Supprimer de Firebase Auth
            await admin.auth().deleteUser(orphanUserId);
            // Log de l'action
            await admin.firestore()
                .collection('audit_logs')
                .add({
                action: 'cleanup_orphan_user',
                deletedUserId: orphanUserId,
                deletedUserEmail: authUser.email,
                performedBy: decodedToken.uid,
                reason: 'Nettoyage utilisateur orphelin suite à incohérence',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            res.status(200).json({
                success: true,
                message: `Utilisateur orphelin ${orphanUserId} (${authUser.email}) supprimé avec succès`,
                deletedFromAuth: true,
                deletedFromFirestore: firestoreUser.exists
            });
        }
        catch (error) {
            console.error('Erreur lors du nettoyage:', error);
            res.status(500).send({ error: 'Erreur lors du nettoyage' });
        }
    });
});
//# sourceMappingURL=cleanupOrphanUser.js.map