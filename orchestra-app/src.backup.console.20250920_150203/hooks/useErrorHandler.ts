import { useCallback } from 'react';
import { useDispatch } from 'react-redux';

// Type pour les erreurs standardisées
interface AppError {
  message: string;
  code?: string;
  details?: any;
  timestamp: Date;
}

// Hook pour la gestion centralisée des erreurs
export const useErrorHandler = () => {
  const dispatch = useDispatch();

  // Fonction pour normaliser les erreurs
  const normalizeError = useCallback((error: any): AppError => {
    if (error instanceof Error) {
      return {
        message: error.message,
        timestamp: new Date(),
        details: error.stack,
      };
    }

    if (typeof error === 'string') {
      return {
        message: error,
        timestamp: new Date(),
      };
    }

    if (error?.code && error?.message) {
      return {
        message: error.message,
        code: error.code,
        timestamp: new Date(),
        details: error,
      };
    }

    return {
      message: 'Une erreur inattendue s\'est produite',
      timestamp: new Date(),
      details: error,
    };
  }, []);

  // Fonction pour gérer les erreurs Firebase Auth
  const handleAuthError = useCallback((error: any): string => {
    const normalizedError = normalizeError(error);
    
    const authErrorMessages: Record<string, string> = {
      'auth/user-not-found': 'Utilisateur non trouvé',
      'auth/wrong-password': 'Mot de passe incorrect',
      'auth/email-already-in-use': 'Cette adresse email est déjà utilisée',
      'auth/weak-password': 'Le mot de passe est trop faible',
      'auth/invalid-email': 'Adresse email invalide',
      'auth/user-disabled': 'Ce compte a été désactivé',
      'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard',
      'auth/network-request-failed': 'Erreur de connexion réseau',
    };

    if (normalizedError.code && authErrorMessages[normalizedError.code]) {
      return authErrorMessages[normalizedError.code];
    }

    return normalizedError.message;
  }, [normalizeError]);

  // Fonction pour gérer les erreurs Firestore
  const handleFirestoreError = useCallback((error: any): string => {
    const normalizedError = normalizeError(error);
    
    const firestoreErrorMessages: Record<string, string> = {
      'permission-denied': 'Permissions insuffisantes',
      'not-found': 'Document non trouvé',
      'already-exists': 'Le document existe déjà',
      'invalid-argument': 'Paramètres invalides',
      'deadline-exceeded': 'Délai d\'attente dépassé',
      'unavailable': 'Service temporairement indisponible',
    };

    if (normalizedError.code && firestoreErrorMessages[normalizedError.code]) {
      return firestoreErrorMessages[normalizedError.code];
    }

    return normalizedError.message;
  }, [normalizeError]);

  // Fonction pour gérer les erreurs réseau
  const handleNetworkError = useCallback((error: any): string => {
    const normalizedError = normalizeError(error);
    
    if (error?.response) {
      const status = error.response.status;
      
      const statusMessages: Record<number, string> = {
        400: 'Requête invalide',
        401: 'Non autorisé',
        403: 'Accès interdit',
        404: 'Ressource non trouvée',
        408: 'Délai d\'attente dépassé',
        500: 'Erreur interne du serveur',
        502: 'Passerelle incorrecte',
        503: 'Service indisponible',
        504: 'Délai d\'attente de la passerelle dépassé',
      };

      if (statusMessages[status]) {
        return statusMessages[status];
      }
    }

    if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
      return 'Erreur de connexion réseau. Vérifiez votre connexion internet.';
    }

    return normalizedError.message;
  }, [normalizeError]);

  // Fonction principale pour gérer tous types d'erreurs
  const handleError = useCallback((error: any, context?: string): string => {
    const normalizedError = normalizeError(error);
    
    

    // Log pour le monitoring en production
    if (process.env.NODE_ENV === 'production') {
      // Ici on pourrait envoyer l'erreur à un service de monitoring
      // sendErrorToService(normalizedError, context);
    }

    // Déterminer le type d'erreur et utiliser le handler approprié
    if (normalizedError.code?.startsWith('auth/')) {
      return handleAuthError(error);
    }

    if (normalizedError.code && ['permission-denied', 'not-found', 'already-exists'].includes(normalizedError.code)) {
      return handleFirestoreError(error);
    }

    if (error?.response || error?.code === 'NETWORK_ERROR') {
      return handleNetworkError(error);
    }

    return normalizedError.message;
  }, [normalizeError, handleAuthError, handleFirestoreError, handleNetworkError]);

  // Wrapper pour les promesses avec gestion d'erreur
  const handleAsyncError = useCallback(async <T>(
    promise: Promise<T>,
    context?: string
  ): Promise<[T | null, string | null]> => {
    try {
      const result = await promise;
      return [result, null];
    } catch (error) {
      const errorMessage = handleError(error, context);
      return [null, errorMessage];
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
    handleAuthError,
    handleFirestoreError,
    handleNetworkError,
    normalizeError,
  };
};