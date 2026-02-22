import { create } from "zustand";
import { User } from "@/types";
import { authService } from "@/services/auth.service";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

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

  logout: () => {
    authService.logout();
    set({
      user: null,
      isAuthenticated: false,
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
