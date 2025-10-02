import { 
  signInWithEmailAndPassword
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User, UserRole } from '../types';

export interface CreateUserRequest {
  login: string;  // Login unique (nom_prenom)
  password: string; // Mot de passe
  firstName: string;
  lastName: string;
  role: UserRole;
  department?: string;
  service?: string;
  displayName?: string;
}

export class AdminUserCreationService {
  
  /**
   * Vérifie si un login est disponible
   */
  async isLoginAvailable(login: string): Promise<boolean> {
    try {
      // Générer un email temporaire basé sur le login pour Firebase Auth
      const tempEmail = `${login}@orchestr-a.local`;
      
      // Vérifier si un utilisateur avec ce login existe déjà
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('login', '==', login));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.empty;
    } catch (error) {
      
      return false;
    }
  }

  /**
   * Crée un nouvel utilisateur avec login/password
   * Seuls les admins peuvent utiliser cette méthode
   */
  async createUserWithLogin(request: CreateUserRequest, createdByAdminId: string, adminPassword?: string): Promise<User> {
    // Vérifier que l'admin qui crée existe et a les bonnes permissions
    await this.validateAdminPermissions(createdByAdminId);
    
    // Validation du login (format nom_prenom)
    if (!this.validateLoginFormat(request.login)) {
      throw new Error('Le login doit être au format "nom_prenom" (lettres, chiffres et underscore uniquement).');
    }
    
    try {
      console.log('🔄 Appel de la Cloud Function HTTP pour créer l\'utilisateur...');
      
      // Obtenir le token d'authentification
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Utilisateur non connecté');
      }
      
      const token = await currentUser.getIdToken();
      
      // Appel HTTP à la Cloud Function
      const response = await fetch('https://us-central1-orchestr-a-3b48e.cloudfunctions.net/createUserWithLogin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          login: request.login,
          password: request.password,
          firstName: request.firstName,
          lastName: request.lastName,
          role: request.role,
          department: request.department,
          displayName: request.displayName
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Erreur lors de la création');
      }
      
      
      // Récupérer les données complètes de l'utilisateur depuis Firestore
      const userDoc = await getDoc(doc(db, 'users', data.uid));
      if (!userDoc.exists()) {
        throw new Error('Utilisateur créé mais profil introuvable');
      }
      
      const userData = { id: userDoc.id, ...userDoc.data() } as User;
      return userData;
      
    } catch (error: any) {
      
      
      // Messages d'erreur spécifiques
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Ce login est déjà utilisé.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Format de login invalide.');
      }
      
      throw new Error(`Erreur lors de la création : ${error.message}`);
    }
  }
  
  /**
   * Service de connexion avec login/password au lieu d'email/password
   */
  async signInWithLogin(login: string, password: string): Promise<User> {
    try {
      // 1. Récupérer l'email interne associé au login
      const internalEmail = this.generateInternalEmail(login);
      
      // 2. Se connecter avec Firebase Auth
      const credential = await signInWithEmailAndPassword(auth, internalEmail, password);
      
      // 3. Récupérer le profil utilisateur depuis Firestore
      const userDocRef = doc(db, 'users', credential.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        throw new Error('Profil utilisateur introuvable.');
      }
      
      const userData = { id: userDoc.id, ...userDoc.data() } as User;
      
      // 4. Vérifier que l'utilisateur est actif
      if (!userData.isActive) {
        throw new Error('Ce compte utilisateur est désactivé.');
      }
      
      // 5. Mettre à jour la dernière connexion
      await updateDoc(userDocRef, {
        lastLoginAt: new Date()
      });
      
      return userData;
      
    } catch (error: any) {
      
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new Error('Login ou mot de passe incorrect.');
      }
      
      throw error;
    }
  }
  
  /**
   * Met à jour le mot de passe d'un utilisateur (admin uniquement)
   */
  async updateUserPassword(userId: string, newPassword: string, adminId: string): Promise<void> {
    await this.validateAdminPermissions(adminId);
    
    // Note: Firebase Admin SDK serait nécessaire pour changer le mot de passe d'un autre utilisateur
    // Pour l'instant, on peut seulement guider l'utilisateur vers la réinitialisation
    throw new Error('La mise à jour de mot de passe nécessite Firebase Admin SDK. Utilisez la fonction de réinitialisation.');
  }
  
  // ===== MÉTHODES PRIVÉES =====
  
  /**
   * Valide les permissions d'administration
   */
  private async validateAdminPermissions(adminId: string): Promise<void> {
    const adminDoc = await getDoc(doc(db, 'users', adminId));
    if (!adminDoc.exists()) {
      throw new Error('Administrateur introuvable.');
    }
    
    const adminData = adminDoc.data() as User;
    // Permettre aux rôles admin ET responsable de créer des utilisateurs
    if (adminData.role !== 'admin' && adminData.role !== 'responsable') {
      throw new Error('Seuls les administrateurs et responsables peuvent créer des utilisateurs.');
    }
    
    if (!adminData.isActive) {
      throw new Error('Compte administrateur inactif.');
    }
  }
  
  /**
   * Valide le format du login
   */
  private validateLoginFormat(login: string): boolean {
    // Regex : lettres, chiffres, underscore, minimum 3 caractères
    const loginRegex = /^[a-zA-Z0-9_]{3,50}$/;
    return loginRegex.test(login);
  }
  
  /**
   * Génère un email interne pour Firebase Auth basé sur le login
   */
  private generateInternalEmail(login: string): string {
    return `${login}@orchestr-a.internal`;
  }
  
  /**
   * Suggère un login basé sur prénom/nom
   */
  static suggestLogin(firstName: string, lastName: string): string {
    const cleanName = (name: string) => name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
      .replace(/[^a-z0-9]/g, ''); // Garder seulement lettres/chiffres
    
    return `${cleanName(firstName)}_${cleanName(lastName)}`;
  }
  
  /**
   * Génère un mot de passe sécurisé aléatoire
   */
  static generateSecurePassword(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Garantir au moins un caractère de chaque type
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // minuscule
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // majuscule
    password += '0123456789'[Math.floor(Math.random() * 10)]; // chiffre
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // spécial
    
    // Compléter avec caractères aléatoires
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Mélanger les caractères
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  }
}

export const adminUserCreationService = new AdminUserCreationService();