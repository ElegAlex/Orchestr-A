import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithRedirect,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../types';

const googleProvider = new GoogleAuthProvider();

export class AuthService {
  async signInWithEmail(email: string, password: string): Promise<User> {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = await this.getUserProfile(credential.user.uid);

    if (!user) {
      // Utilisateur Firebase existant mais pas de profil dans Firestore
      // Seuls les administrateurs peuvent créer de nouveaux profils
      throw new Error('Compte non autorisé. Contactez votre administrateur pour obtenir l\'accès.');
    }

    await this.updateLastLogin(user.id);
    return user;
  }

  async signInWithGoogle(): Promise<User> {
    try {
      const { signInWithPopup } = await import('firebase/auth');
      const result = await signInWithPopup(auth, googleProvider);

      const user = await this.getUserProfile(result.user.uid);
      if (!user) {
        // Utilisateur Google existant mais pas de profil dans l'application
        // Seuls les administrateurs peuvent créer de nouveaux profils
        throw new Error('Compte non autorisé. Contactez votre administrateur pour obtenir l\'accès.');
      }

      await this.updateLastLogin(user.id);
      return user;
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
        throw new Error('Redirection en cours...');
      }
      throw error;
    }
  }

  async signUpWithEmail(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<User> {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = credential.user;
    
    await updateProfile(firebaseUser, {
      displayName: `${firstName} ${lastName}`
    });
    
    const user = await this.createUserProfile(firebaseUser, {
      firstName,
      lastName
    });
    
    return user;
  }

  async signOut(): Promise<void> {
    await signOut(auth);
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  async getUserProfile(uid: string): Promise<User | null> {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as User;
    }
    
    return null;
  }

  async createUserProfile(
    firebaseUser: FirebaseUser,
    additionalData?: Partial<User>
  ): Promise<User> {
    const user: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: firebaseUser.displayName || '',
      firstName: additionalData?.firstName || firebaseUser.displayName?.split(' ')[0] || '',
      lastName: additionalData?.lastName || firebaseUser.displayName?.split(' ')[1] || '',
      role: 'viewer', // Défaut viewer pour sécurité
      isActive: true,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      ...additionalData
    };
    
    await setDoc(doc(db, 'users', user.id), user);
    return user;
  }

  private async updateLastLogin(uid: string): Promise<void> {
    await updateDoc(doc(db, 'users', uid), {
      lastLoginAt: serverTimestamp()
    });
  }

  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  // Méthode supprimée - Utiliser adminUserCreationService.createUserWithLogin() à la place
}

export const authService = new AuthService();