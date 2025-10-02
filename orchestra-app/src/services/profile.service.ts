import {
  doc,
  updateDoc,
  getDocs,
  query,
  collection,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import {
  updatePassword as firebaseUpdatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateProfile as firebaseUpdateProfile
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from '../config/firebase';
import { User, UserPreferences } from '../types';

interface ProfileStats {
  activeProjects: number;
  completedTasks: number;
  totalTimeSpent: number;
  completedProjects: number;
  averageTaskCompletion: number;
}

interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  department?: string;
  preferences?: UserPreferences;
}


interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}

class ProfileService {
  /**
   * Met à jour les informations du profil utilisateur
   */
  async updateProfile(userId: string, profileData: UpdateProfileData): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      const updateData = {
        ...profileData,
        updatedAt: new Date()
      };

      // Si displayName est modifié, mettre à jour aussi Firebase Auth
      if (profileData.displayName && auth.currentUser) {
        await firebaseUpdateProfile(auth.currentUser, {
          displayName: profileData.displayName
        });
      }

      await updateDoc(userRef, updateData);
      console.log('✅ Profil mis à jour avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du profil:', error);
      throw new Error('Impossible de mettre à jour le profil');
    }
  }

  /**
   * Change le mot de passe de l'utilisateur
   */
  async changePassword(passwordData: PasswordChangeData): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non connecté');
    }

    try {
      const user = auth.currentUser;

      // Ré-authentifier l'utilisateur avec son mot de passe actuel
      const credential = EmailAuthProvider.credential(
        user.email!,
        passwordData.currentPassword
      );

      await reauthenticateWithCredential(user, credential);

      // Changer le mot de passe
      await firebaseUpdatePassword(user, passwordData.newPassword);

      console.log('✅ Mot de passe changé avec succès');
    } catch (error: any) {
      console.error('❌ Erreur lors du changement de mot de passe:', error);

      if (error.code === 'auth/wrong-password') {
        throw new Error('Mot de passe actuel incorrect');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Le nouveau mot de passe est trop faible');
      } else if (error.code === 'auth/requires-recent-login') {
        throw new Error('Veuillez vous reconnecter avant de changer votre mot de passe');
      } else {
        throw new Error('Impossible de changer le mot de passe');
      }
    }
  }

  /**
   * Upload un avatar personnalisé
   */
  async uploadAvatar(userId: string, file: File): Promise<string> {
    try {
      // Valider le fichier
      if (!file.type.startsWith('image/')) {
        throw new Error('Le fichier doit être une image');
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB max
        throw new Error('L\'image ne doit pas dépasser 5MB');
      }

      // Créer une référence unique pour l'avatar
      const fileExtension = file.name.split('.').pop();
      const avatarRef = ref(storage, `avatars/${userId}/avatar.${fileExtension}`);

      // Upload du fichier
      const uploadResult = await uploadBytes(avatarRef, file);

      // Récupérer l'URL de téléchargement
      const downloadURL = await getDownloadURL(uploadResult.ref);

      console.log('✅ Avatar uploadé avec succès:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload de l\'avatar:', error);
      throw new Error('Impossible d\'uploader l\'avatar');
    }
  }

  /**
   * Supprime l'avatar actuel
   */
  async deleteAvatar(userId: string, avatarUrl?: string): Promise<void> {
    if (!avatarUrl) return;

    try {
      // Créer la référence vers l'avatar à supprimer
      const avatarRef = ref(storage, `avatars/${userId}/avatar.jpg`);
      await deleteObject(avatarRef);

      console.log('✅ Avatar supprimé avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la suppression de l\'avatar:', error);
      // Ne pas faire échouer l'opération si l'avatar n'existe pas
    }
  }

  /**
   * Met à jour les préférences utilisateur
   */
  async updatePreferences(userId: string, preferences: UserPreferences): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        preferences,
        updatedAt: new Date()
      });

      console.log('✅ Préférences mises à jour avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour des préférences:', error);
      throw new Error('Impossible de mettre à jour les préférences');
    }
  }

  /**
   * Récupère les statistiques du profil utilisateur
   */
  async getProfileStats(userId: string): Promise<ProfileStats> {
    try {
      const stats: ProfileStats = {
        activeProjects: 0,
        completedTasks: 0,
        totalTimeSpent: 0,
        completedProjects: 0,
        averageTaskCompletion: 0
      };

      // Récupérer les projets actifs de l'utilisateur
      const activeProjectsQuery = query(
        collection(db, 'projects'),
        where('teamMembers', 'array-contains', { userId }),
        where('status', '==', 'active')
      );
      const activeProjectsSnapshot = await getDocs(activeProjectsQuery);
      stats.activeProjects = activeProjectsSnapshot.size;

      // Récupérer les projets terminés
      const completedProjectsQuery = query(
        collection(db, 'projects'),
        where('teamMembers', 'array-contains', { userId }),
        where('status', '==', 'completed')
      );
      const completedProjectsSnapshot = await getDocs(completedProjectsQuery);
      stats.completedProjects = completedProjectsSnapshot.size;

      // Récupérer les tâches terminées
      const completedTasksQuery = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', userId),
        where('status', '==', 'DONE'),
        orderBy('updatedAt', 'desc'),
        limit(100)
      );
      const completedTasksSnapshot = await getDocs(completedTasksQuery);
      stats.completedTasks = completedTasksSnapshot.size;

      // Calculer la moyenne de completion (basé sur les 30 derniers jours)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentTasksQuery = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', userId),
        where('updatedAt', '>=', thirtyDaysAgo)
      );
      const recentTasksSnapshot = await getDocs(recentTasksQuery);

      if (recentTasksSnapshot.size > 0) {
        const completedRecent = recentTasksSnapshot.docs.filter(
          doc => doc.data().status === 'DONE'
        ).length;
        stats.averageTaskCompletion = Math.round((completedRecent / recentTasksSnapshot.size) * 100);
      }

      console.log('✅ Statistiques profil récupérées:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des statistiques:', error);
      // Retourner des stats vides en cas d'erreur
      return {
        activeProjects: 0,
        completedTasks: 0,
        totalTimeSpent: 0,
        completedProjects: 0,
        averageTaskCompletion: 0
      };
    }
  }

  /**
   * Valide un fichier d'avatar
   */
  validateAvatarFile(file: File): { isValid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Format non supporté. Utilisez JPG, PNG ou WebP.'
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'L\'image ne doit pas dépasser 5MB.'
      };
    }

    return { isValid: true };
  }

  /**
   * Redimensionne une image avant upload
   */
  async resizeImage(file: File, maxWidth: number = 400, maxHeight: number = 400): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculer les nouvelles dimensions
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        // Redimensionner sur le canvas
        canvas.width = width;
        canvas.height = height;
        ctx!.drawImage(img, 0, 0, width, height);

        // Convertir en blob puis en File
        canvas.toBlob((blob) => {
          const resizedFile = new File([blob!], file.name, {
            type: file.type,
            lastModified: Date.now()
          });
          resolve(resizedFile);
        }, file.type, 0.9);
      };

      img.src = URL.createObjectURL(file);
    });
  }
}

export const profileService = new ProfileService();
export type { ProfileStats, UpdateProfileData, PasswordChangeData };