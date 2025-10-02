"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanAuthUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
exports.cleanAuthUser = (0, https_1.onCall)({
    cors: true,
}, async (request) => {
    try {
        const { uid } = request.data;
        if (!uid) {
            throw new Error('UID requis');
        }
        console.log(`🗑️ Suppression de l'utilisateur Firebase Auth: ${uid}`);
        // Supprimer l'utilisateur de Firebase Auth
        await (0, auth_1.getAuth)().deleteUser(uid);
        console.log(`✅ Utilisateur ${uid} supprimé de Firebase Auth`);
        return {
            success: true,
            message: `Utilisateur ${uid} supprimé de Firebase Auth`
        };
    }
    catch (error) {
        console.error('❌ Erreur lors de la suppression:', error);
        throw new Error(`Erreur: ${error.message}`);
    }
});
//# sourceMappingURL=cleanAuthUser.js.map