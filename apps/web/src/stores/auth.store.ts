import { create } from "zustand";
import { User } from "@/types";
import { authService } from "@/services/auth.service";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: string[];
  permissionsLoaded: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setPermissions: (perms: string[]) => void;
  clearPermissions: () => void;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  permissions: [],
  permissionsLoaded: false,

  setUser: (user) => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    }
    set({
      user,
      isAuthenticated: !!user,
    });
  },

  setLoading: (loading) =>
    set({
      isLoading: loading,
    }),

  setPermissions: (perms) =>
    set({
      permissions: perms,
      permissionsLoaded: true,
    }),

  clearPermissions: () =>
    set({
      permissions: [],
      permissionsLoaded: false,
    }),

  logout: () => {
    authService.logout();
    set({
      user: null,
      isAuthenticated: false,
      permissions: [],
      permissionsLoaded: false,
    });
  },

  checkAuth: () => {
    const user = authService.getCurrentUser();
    set({
      user,
      isAuthenticated: authService.isAuthenticated(),
      isLoading: false,
    });
  },
}));
