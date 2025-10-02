import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { User } from '../types';

interface AuthHook {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useAuth = (): AuthHook => {
  const { user, isAuthenticated, isLoading, error } = useSelector(
    (state: RootState) => state.auth
  );

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
  };
};