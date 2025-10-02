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
exports.createUserWithLogin = void 0;
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
exports.createUserWithLogin = functions
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
            const { login, password, firstName, lastName, role, department, displayName } = req.body;
            // Validation
            if (!login || !password || !firstName || !lastName || !role) {
                res.status(400).send({
                    error: 'Données manquantes pour la création de l\'utilisateur'
                });
                return;
            }
            if (password.length < 6) {
                res.status(400).send({
                    error: 'Le mot de passe doit contenir au moins 6 caractères'
                });
                return;
            }
            // Check if login is already taken
            const usersWithLogin = await admin.firestore()
                .collection('users')
                .where('login', '==', login)
                .get();
            if (!usersWithLogin.empty) {
                res.status(409).send({
                    error: `Le login "${login}" est déjà utilisé`
                });
                return;
            }
            // Generate internal email
            const internalEmail = `${login}@orchestr-a.internal`;
            // NOUVELLE LOGIQUE : Vérifier dans Firebase Auth ET synchroniser si nécessaire
            let existingAuthUser;
            try {
                existingAuthUser = await admin.auth().getUserByEmail(internalEmail);
            }
            catch (authCheckError) {
                // Si l'erreur est "user not found", c'est OK, on continue
                if (authCheckError.code !== 'auth/user-not-found') {
                    console.error('Erreur lors de la vérification Auth:', authCheckError);
                    res.status(500).send({ error: 'Erreur lors de la vérification' });
                    return;
                }
            }
            // Si l'utilisateur existe dans Auth, on vérifie s'il existe dans Firestore
            if (existingAuthUser) {
                const existingFirestoreUser = await admin.firestore()
                    .collection('users')
                    .doc(existingAuthUser.uid)
                    .get();
                if (!existingFirestoreUser.exists) {
                    // L'utilisateur existe dans Auth mais pas dans Firestore
                    // On crée le profil Firestore avec les nouvelles données
                    console.log(`Synchronisation: utilisateur ${internalEmail} existe dans Auth mais pas dans Firestore`);
                    const userData = {
                        id: existingAuthUser.uid,
                        email: internalEmail,
                        login: login,
                        displayName: displayName || `${firstName} ${lastName}`,
                        firstName: firstName,
                        lastName: lastName,
                        role: role,
                        department: department || '',
                        isActive: true,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
                        createdBy: decodedToken.uid,
                        loginType: 'internal',
                    };
                    try {
                        await admin.firestore()
                            .collection('users')
                            .doc(existingAuthUser.uid)
                            .set(userData);
                        // Mettre à jour le mot de passe si fourni
                        await admin.auth().updateUser(existingAuthUser.uid, {
                            password: password,
                            displayName: displayName || `${firstName} ${lastName}`,
                        });
                        res.status(200).json({
                            success: true,
                            uid: existingAuthUser.uid,
                            login: login,
                            message: `Utilisateur "${login}" synchronisé et mis à jour avec succès`
                        });
                        return;
                    }
                    catch (syncError) {
                        console.error('Erreur lors de la synchronisation:', syncError);
                        res.status(500).send({ error: 'Erreur lors de la synchronisation de l\'utilisateur' });
                        return;
                    }
                }
                else {
                    // L'utilisateur existe déjà complètement
                    res.status(409).send({
                        error: `Un utilisateur avec le login "${login}" existe déjà`
                    });
                    return;
                }
            }
            let userRecord;
            try {
                // Create the user in Firebase Auth (server-side, won't affect client session)
                userRecord = await admin.auth().createUser({
                    email: internalEmail,
                    password: password,
                    displayName: displayName || `${firstName} ${lastName}`,
                });
            }
            catch (authError) {
                console.error('Erreur lors de la création dans Auth:', authError);
                if (authError.code === 'auth/email-already-exists') {
                    res.status(409).send({ error: 'Ce login est déjà utilisé' });
                }
                else {
                    res.status(500).send({ error: 'Erreur lors de la création de l\'utilisateur' });
                }
                return;
            }
            // Create the user profile in Firestore
            const userData = {
                id: userRecord.uid,
                email: internalEmail,
                login: login,
                displayName: displayName || `${firstName} ${lastName}`,
                firstName: firstName,
                lastName: lastName,
                role: role,
                department: department || '',
                isActive: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: decodedToken.uid,
                loginType: 'internal',
            };
            try {
                await admin.firestore()
                    .collection('users')
                    .doc(userRecord.uid)
                    .set(userData);
                res.status(200).json({
                    success: true,
                    uid: userRecord.uid,
                    login: login,
                    message: `Utilisateur "${login}" créé avec succès`
                });
            }
            catch (firestoreError) {
                // SI FIRESTORE ÉCHOUE, ON SUPPRIME L'UTILISATEUR DE AUTH !
                console.error('Erreur Firestore, suppression de l\'utilisateur Auth:', firestoreError);
                try {
                    await admin.auth().deleteUser(userRecord.uid);
                    console.log('Utilisateur supprimé de Auth suite à l\'échec Firestore');
                }
                catch (deleteError) {
                    console.error('Impossible de supprimer l\'utilisateur Auth:', deleteError);
                }
                res.status(500).send({ error: 'Erreur lors de la création du profil utilisateur' });
            }
        }
        catch (error) {
            console.error('Erreur lors de la création de l\'utilisateur:', error);
            // Clean error messages
            if (error.code === 'auth/email-already-exists') {
                res.status(409).send({ error: 'Ce login est déjà utilisé' });
            }
            else if (error.code === 'auth/invalid-password') {
                res.status(400).send({ error: 'Mot de passe invalide' });
            }
            else {
                res.status(500).send({ error: 'Erreur lors de la création de l\'utilisateur' });
            }
        }
    });
});
//# sourceMappingURL=createUser.js.map