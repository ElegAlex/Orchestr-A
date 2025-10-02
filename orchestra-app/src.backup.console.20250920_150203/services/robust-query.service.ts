/**
 * Service de requêtes Firestore robustes avec retry et fallback automatique
 */

import { 
  Query, 
  QuerySnapshot, 
  DocumentSnapshot,
  getDocs, 
  getDoc,
  getDocsFromServer,
  getDocFromServer,
  query,
  collection,
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { cacheManagerService } from './cache-manager.service';

interface RetryOptions {
  maxRetries: number;
  delay: number;
  useServerOnly: boolean;
  autoCleanCache: boolean;
}

export class RobustQueryService {
  private defaultOptions: RetryOptions = {
    maxRetries: 3,
    delay: 1000,
    useServerOnly: true,
    autoCleanCache: true
  };

  /**
   * Requête robuste avec retry automatique pour collections
   */
  async queryWithRetry(
    query: Query, 
    options: Partial<RetryOptions> = {}
  ): Promise<QuerySnapshot> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: Error | null = null;
    
    console.log(`🔄 Début requête robuste (max ${opts.maxRetries} tentatives)`);

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        console.log(`📡 Tentative ${attempt}/${opts.maxRetries}...`);
        
        // Forcer le mode réseau si demandé
        if (opts.useServerOnly) {
          await cacheManagerService.ensureNetworkFirst();
          console.log('🌐 Mode serveur forcé');
          return await getDocsFromServer(query);
        } else {
          return await getDocs(query);
        }
        
      } catch (error) {
        lastError = error as Error;
        
        
        // Si c'est la dernière tentative, pas de retry
        if (attempt === opts.maxRetries) {
          
          break;
        }
        
        // Nettoyage automatique du cache à la 2ème tentative
        if (attempt === 2 && opts.autoCleanCache) {
          const cleaned = await cacheManagerService.autoRecover();
          if (cleaned) {
          }
        }
        
        // Attendre avant la prochaine tentative
        if (attempt < opts.maxRetries) {
          const waitTime = opts.delay * attempt; // Backoff exponentiel
          console.log(`⏳ Attente ${waitTime}ms avant nouvelle tentative...`);
          await this.delay(waitTime);
        }
      }
    }
    
    // Toutes les tentatives ont échoué
    
    throw new Error(`Requête échouée après ${opts.maxRetries} tentatives: ${lastError?.message}`);
  }

  /**
   * Requête robuste avec retry automatique pour documents
   */
  async getDocumentWithRetry(
    docRef: any,
    options: Partial<RetryOptions> = {}
  ): Promise<DocumentSnapshot> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: Error | null = null;
    
    console.log(`🔄 Début récupération document robuste (max ${opts.maxRetries} tentatives)`);

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        console.log(`📡 Tentative document ${attempt}/${opts.maxRetries}...`);
        
        // Forcer le mode réseau si demandé
        if (opts.useServerOnly) {
          await cacheManagerService.ensureNetworkFirst();
          console.log('🌐 Mode serveur forcé pour document');
          return await getDocFromServer(docRef);
        } else {
          return await getDoc(docRef);
        }
        
      } catch (error) {
        lastError = error as Error;
        
        
        // Si c'est la dernière tentative, pas de retry
        if (attempt === opts.maxRetries) {
          
          break;
        }
        
        // Nettoyage automatique du cache à la 2ème tentative
        if (attempt === 2 && opts.autoCleanCache) {
          const cleaned = await cacheManagerService.autoRecover();
          if (cleaned) {
          }
        }
        
        // Attendre avant la prochaine tentative
        if (attempt < opts.maxRetries) {
          const waitTime = opts.delay * attempt; // Backoff exponentiel
          console.log(`⏳ Attente ${waitTime}ms avant nouvelle tentative document...`);
          await this.delay(waitTime);
        }
      }
    }
    
    // Toutes les tentatives ont échoué
    
    throw new Error(`Récupération document échouée après ${opts.maxRetries} tentatives: ${lastError?.message}`);
  }

  /**
   * Requête simple avec fallback cache → serveur
   */
  async queryWithFallback(query: Query): Promise<QuerySnapshot> {
    try {
      console.log('📱 Tentative avec cache local...');
      return await getDocs(query);
    } catch (cacheError) {
      console.warn('⚠️ Cache échoué, tentative serveur...', cacheError);
      try {
        await cacheManagerService.ensureNetworkFirst();
        console.log('🌐 Fallback vers serveur...');
        return await getDocsFromServer(query);
      } catch (serverError) {
        
        const errorMessage = serverError instanceof Error ? serverError.message : String(serverError);
        throw new Error(`Cache ET serveur échoués: ${errorMessage}`);
      }
    }
  }

  /**
   * Batch de requêtes robustes avec gestion d'échec partiel
   */
  async batchQueries<T>(
    queries: Array<{ name: string; query: Query | any; transform: (snapshot: any) => T }>,
    options: Partial<RetryOptions> = {}
  ): Promise<{ [key: string]: T | null }> {
    const results: { [key: string]: T | null } = {};
    
    console.log(`🔄 Début batch de ${queries.length} requêtes robustes`);
    
    // Exécuter toutes les requêtes en parallèle
    const promises = queries.map(async ({ name, query, transform }) => {
      try {
        console.log(`📡 Batch: ${name}...`);
        
        const snapshot = typeof query.get === 'function'
          ? await this.getDocumentWithRetry(query, options)
          : await this.queryWithRetry(query, options);
          
        results[name] = transform(snapshot);
      } catch (error) {
        
        results[name] = null; // Retourner null pour les échecs
      }
    });
    
    // Attendre toutes les requêtes (même les échecs)
    await Promise.allSettled(promises);
    
    const successCount = Object.values(results).filter(r => r !== null).length;
    console.log(`📊 Batch terminé: ${successCount}/${queries.length} succès`);
    
    return results;
  }

  /**
   * Helper pour les délais
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Diagnostic de connectivité
   */
  async testConnectivity(): Promise<{
    cacheWorking: boolean;
    serverWorking: boolean;
    latency: number;
  }> {
    const startTime = Date.now();
    
    try {
      
      // Test du cache (requête simple)
      let cacheWorking = false;
      try {
        // Utiliser une requête basique qui devrait toujours marcher
        const testQuery = query(collection(db, 'tasks'), limit(1));
        await getDocs(testQuery);
        cacheWorking = true;
      } catch (error) {
      }
      
      // Test du serveur
      let serverWorking = false;
      try {
        const testQuery = query(collection(db, 'tasks'), limit(1));
        await getDocsFromServer(testQuery);
        serverWorking = true;
      } catch (error) {
      }
      
      const latency = Date.now() - startTime;
      
      const result = {
        cacheWorking,
        serverWorking,
        latency
      };
      
      console.log('📊 Résultat connectivité:', result);
      return result;
      
    } catch (error) {
      
      return {
        cacheWorking: false,
        serverWorking: false,
        latency: Date.now() - startTime
      };
    }
  }
}

export const robustQueryService = new RobustQueryService();