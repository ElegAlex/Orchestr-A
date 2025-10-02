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
exports.updateUserLogin = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
// Initialize admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}
// Configuration CORS
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
exports.updateUserLogin = functions
    .region('us-central1')
    .https.onRequest(async (req, res) => {
    // Handle CORS
    return corsHandler(req, res, async () => {
        var _a;
        try {
            // Only allow POST requests
            if (req.method !== 'POST') {
                res.status(405).send({ error: 'Method not allowed' });
                return;
            }
            // Verify Firebase token from Authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.status(401).send({ error: 'Unauthorized: No valid token provided' });
                return;
            }
            const token = authHeader.split('Bearer ')[1];
            let decodedToken;
            try {
                decodedToken = await admin.auth().verifyIdToken(token);
            }
            catch (error) {
                console.error('Token verification failed:', error);
                res.status(401).send({ error: 'Unauthorized: Invalid token' });
                return;
            }
            // Check that the user is an admin
            const adminUser = await admin.firestore()
                .collection('users')
                .doc(decodedToken.uid)
                .get();
            if (!adminUser.exists || ((_a = adminUser.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
                res.status(403).send({ error: 'Permission denied: Admin access required' });
                return;
            }
            const { userId, newLogin, newPassword } = req.body;
            // Validation
            if (!userId || !newLogin) {
                res.status(400).send({
                    error: 'Données manquantes : userId et newLogin sont requis'
                });
                return;
            }
            // Validate login format (lettres, chiffres et underscore)
            const loginRegex = /^[a-zA-Z0-9_]+$/;
            if (!loginRegex.test(newLogin)) {
                res.status(400).send({
                    error: 'Le login doit contenir uniquement des lettres, chiffres et underscore'
                });
                return;
            }
            // Generate new internal email
            const newEmail = `${newLogin}@orchestr-a.internal`;
            // LOGIQUE SIMPLIFIÉE : On modifie un utilisateur existant
            // Pas besoin de vérifier les conflits - on UPDATE son email
            console.log(`🔄 Modification de l'utilisateur ${userId}:`);
            console.log(`   Nouveau login: ${newLogin}`);
            console.log(`   Nouveau email: ${newEmail}`);
            try {
                // Get current user data from Firestore
                const userDoc = await admin.firestore()
                    .collection('users')
                    .doc(userId)
                    .get();
                if (!userDoc.exists) {
                    res.status(404).send({ error: 'Utilisateur non trouvé dans Firestore' });
                    return;
                }
                const currentUserData = userDoc.data();
                const oldLogin = currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.login;
                const oldEmail = currentUserData === null || currentUserData === void 0 ? void 0 : currentUserData.email;
                // Si le login n'a pas changé, on peut juste mettre à jour Firestore
                if (oldLogin === newLogin) {
                    console.log(`Le login n'a pas changé (${newLogin}), mise à jour Firestore uniquement`);
                    // Mise à jour Firestore seulement (pas Firebase Auth)
                    await admin.firestore()
                        .collection('users')
                        .doc(userId)
                        .update({
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastModifiedBy: decodedToken.uid
                    });
                    // Optionnellement mettre à jour le mot de passe si fourni
                    if (newPassword && newPassword.length >= 6) {
                        await admin.auth().updateUser(userId, {
                            password: newPassword
                        });
                    }
                    res.status(200).json({
                        success: true,
                        message: `Utilisateur "${newLogin}" mis à jour avec succès (login inchangé)`,
                        newLogin: newLogin,
                        newEmail: newEmail
                    });
                    return;
                }
                // Update Firebase Auth
                const updateData = {
                    email: newEmail
                };
                if (newPassword && newPassword.length >= 6) {
                    updateData.password = newPassword;
                }
                await admin.auth().updateUser(userId, updateData);
                // Update Firestore
                await admin.firestore()
                    .collection('users')
                    .doc(userId)
                    .update({
                    login: newLogin,
                    email: newEmail,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastModifiedBy: decodedToken.uid
                });
                // Log the change for audit
                await admin.firestore()
                    .collection('audit_logs')
                    .add({
                    action: 'update_user_login',
                    userId: userId,
                    performedBy: decodedToken.uid,
                    oldLogin: oldLogin,
                    newLogin: newLogin,
                    oldEmail: oldEmail,
                    newEmail: newEmail,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
                res.status(200).json({
                    success: true,
                    message: `Login mis à jour avec succès de "${oldLogin}" vers "${newLogin}"`,
                    newLogin: newLogin,
                    newEmail: newEmail
                });
            }
            catch (updateError) {
                console.error('Erreur lors de la mise à jour:', updateError);
                if (updateError.code === 'auth/email-already-exists') {
                    res.status(409).send({ error: 'Cet email est déjà utilisé' });
                }
                else if (updateError.code === 'auth/invalid-email') {
                    res.status(400).send({ error: 'Format d\'email invalide' });
                }
                else if (updateError.code === 'auth/invalid-password') {
                    res.status(400).send({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
                }
                else {
                    res.status(500).send({ error: 'Erreur lors de la mise à jour du login' });
                }
            }
        }
        catch (error) {
            console.error('Erreur lors de la mise à jour du login:', error);
            res.status(500).send({ error: 'Erreur lors de la mise à jour du login' });
        }
    });
});
//# sourceMappingURL=updateUserLogin.js.map