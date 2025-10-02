import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { RootState } from '../store';
import { userSimulationService } from '../services/user-simulation.service';
import { User } from '../types';
import { usePermissionsFor } from './usePermissions';

/**
 * Hook qui utilise l'utilisateur simulé quand une simulation est active,
 * sinon l'utilisateur connecté normal
 */
export const useSimulatedUser = () => {
  const { user: currentUser } = useSelector((state: RootState) => state.auth);
  const [effectiveUser, setEffectiveUser] = useState<User | null>(currentUser);
  const [isSimulating, setIsSimulating] = useState(false);
  const [originalUser, setOriginalUser] = useState<User | null>(null);

  useEffect(() => {
    // S'abonner aux changements de simulation
    const unsubscribe = userSimulationService.subscribe((context) => {
      if (context.isActive && context.simulatedUser) {
        setEffectiveUser(context.simulatedUser);
        setIsSimulating(true);
        setOriginalUser(currentUser);
      } else {
        setEffectiveUser(currentUser);
        setIsSimulating(false);
        setOriginalUser(null);
      }
    });

    // Vérifier l'état initial
    const context = userSimulationService.getSimulationContext();
    if (context.isActive && context.simulatedUser) {
      setEffectiveUser(context.simulatedUser);
      setIsSimulating(true);
      setOriginalUser(currentUser);
    } else {
      setEffectiveUser(currentUser);
      setIsSimulating(false);
      setOriginalUser(null);
    }

    return unsubscribe;
  }, [currentUser]);

  return {
    user: effectiveUser,
    isSimulating,
    originalUser,
    realUser: currentUser
  };
};

/**
 * Hook qui combine usePermissions avec la simulation
 * Les permissions sont calculées pour l'utilisateur simulé si une simulation est active
 */
export const useSimulatedPermissions = () => {
  const { user: effectiveUser, isSimulating, originalUser } = useSimulatedUser();
  const effectivePermissions = usePermissionsFor(effectiveUser);

  return {
    ...effectivePermissions,
    isSimulating,
    originalUser,
    simulatedUser: effectiveUser,
    realUser: originalUser || effectiveUser
  };
};

/**
 * Hook spécialisé pour les services qui ont besoin de l'ID utilisateur effectif
 */
export const useEffectiveUserId = (): string | undefined => {
  const { user } = useSimulatedUser();
  return user?.id;
};