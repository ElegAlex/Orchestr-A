import { onCall } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';

export const cleanAuthUser = onCall({
  cors: true,
}, async (request) => {
  try {
    const { uid } = request.data;
    
    if (!uid) {
      throw new Error('UID requis');
    }

    console.log(`🗑️ Suppression de l'utilisateur Firebase Auth: ${uid}`);
    
    // Supprimer l'utilisateur de Firebase Auth
    await getAuth().deleteUser(uid);
    
    console.log(`✅ Utilisateur ${uid} supprimé de Firebase Auth`);
    
    return { 
      success: true, 
      message: `Utilisateur ${uid} supprimé de Firebase Auth` 
    };
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la suppression:', error);
    throw new Error(`Erreur: ${error.message}`);
  }
});