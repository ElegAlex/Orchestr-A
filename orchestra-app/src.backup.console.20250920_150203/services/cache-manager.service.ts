/**
 * Service de gestion robuste du cache Firestore
 * Assure la cohérence des données entre différents postes
 */

import { db } from '../config/firebase';
import { 
  enableNetwork, 
  disableNetwork
} from 'firebase/firestore';

export class CacheManagerService {
  private isNetworkEnabled = true;
  private cacheCleanupInProgress = false;

  /**
   * Force la requête réseau et bypass le cache local
   */
  async ensureNetworkFirst(): Promise<void> {
    try {
      if (!this.isNetworkEnabled) {
        console.log('🌐 Réactivation du réseau Firestore...');
        await enableNetwork(db);
        this.isNetworkEnabled = true;
      }
    } catch (error) {
      console.warn('⚠️ Impossible de forcer le mode réseau:', error);
    }
  }

  /**
   * Nettoie le cache local corrompu
   */
  async clearCorruptedCache(): Promise<boolean> {
    if (this.cacheCleanupInProgress) {
      console.log('🔄 Nettoyage cache déjà en cours...');
      return false;
    }

    try {
      this.cacheCleanupInProgress = true;
      
      // Plutôt que clearPersistence (non disponible en v9), 
      // on force juste le mode réseau et nettoie le cache navigateur
      
      // Désactiver puis réactiver pour forcer un refresh de connexion
      await disableNetwork(db);
      this.isNetworkEnabled = false;
      
      // Petite pause pour s'assurer de la déconnexion
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Réactiver le réseau en mode forcé
      await enableNetwork(db);
      this.isNetworkEnabled = true;
      
      return true;
    } catch (error) {
      
      
      // S'assurer que le réseau est réactivé même en cas d'erreur
      try {
        await enableNetwork(db);
        this.isNetworkEnabled = true;
      } catch (networkError) {
        
      }
      
      return false;
    } finally {
      this.cacheCleanupInProgress = false;
    }
  }

  /**
   * Nettoie le cache du navigateur (localStorage, sessionStorage, indexedDB)
   */
  async clearBrowserCache(): Promise<void> {
    try {
      
      // Nettoyer localStorage
      const orchestraKeys = Object.keys(localStorage).filter(key => 
        key.includes('firebase') || key.includes('orchestr') || key.includes('auth')
      );
      orchestraKeys.forEach(key => localStorage.removeItem(key));
      
      // Nettoyer sessionStorage
      const sessionKeys = Object.keys(sessionStorage).filter(key => 
        key.includes('firebase') || key.includes('orchestr') || key.includes('auth')
      );
      sessionKeys.forEach(key => sessionStorage.removeItem(key));
      
      // Supprimer les bases IndexedDB Firebase
      if ('indexedDB' in window) {
        try {
          const databases = [
            'firebaseLocalStorageDb',
            'firebase-heartbeat-database',
            'firebase-installations-database'
          ];
          
          for (const dbName of databases) {
            const deleteReq = indexedDB.deleteDatabase(dbName);
            await new Promise((resolve, reject) => {
              deleteReq.onsuccess = () => resolve(true);
              deleteReq.onerror = () => reject(deleteReq.error);
              deleteReq.onblocked = () => resolve(true); // Continuer même si bloqué
            });
          }
        } catch (error) {
          console.warn('⚠️ Erreur lors du nettoyage IndexedDB:', error);
        }
      }
      
    } catch (error) {
      
    }
  }

  /**
   * Diagnostic complet de l'état du cache
   */
  async diagnoseCache(): Promise<{
    networkEnabled: boolean;
    cacheSize: string;
    indexedDBExists: boolean;
    localStorageKeys: number;
  }> {
    try {
      const diagnosis = {
        networkEnabled: this.isNetworkEnabled,
        cacheSize: 'unknown',
        indexedDBExists: false,
        localStorageKeys: 0
      };

      // Compter les clés localStorage liées à Firebase
      diagnosis.localStorageKeys = Object.keys(localStorage)
        .filter(key => key.includes('firebase')).length;

      // Vérifier IndexedDB
      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases?.() || [];
          diagnosis.indexedDBExists = databases.some(db => 
            db.name?.includes('firebase') || db.name?.includes('orchestr')
          );
        } catch (error) {
          console.warn('⚠️ Impossible de lister les databases IndexedDB:', error);
        }
      }

      console.log('📊 Diagnostic cache:', diagnosis);
      return diagnosis;
    } catch (error) {
      
      return {
        networkEnabled: this.isNetworkEnabled,
        cacheSize: 'error',
        indexedDBExists: false,
        localStorageKeys: 0
      };
    }
  }

  /**
   * Récupération automatique en cas de problème de cache
   */
  async autoRecover(): Promise<boolean> {
    try {
      
      // 1. Diagnostic
      const diagnosis = await this.diagnoseCache();
      
      // 2. Si problème détecté, nettoyer
      if (!diagnosis.networkEnabled || diagnosis.indexedDBExists) {
        console.log('🚨 Problème de cache détecté, nettoyage...');
        
        // Nettoyer le cache Firestore
        await this.clearCorruptedCache();
        
        // Nettoyer le cache navigateur
        await this.clearBrowserCache();
        
        // Forcer le mode réseau
        await this.ensureNetworkFirst();
        
        return true;
      }
      
      return false;
    } catch (error) {
      
      return false;
    }
  }

  /**
   * Initialisation robuste avec retry automatique
   */
  async initializeRobustCache(): Promise<void> {
    try {
      
      // S'assurer que le réseau est activé
      await this.ensureNetworkFirst();
      
      // Diagnostic initial
      await this.diagnoseCache();
      
    } catch (error) {
      
      
      // Tentative de récupération
      await this.autoRecover();
    }
  }
}

export const cacheManagerService = new CacheManagerService();