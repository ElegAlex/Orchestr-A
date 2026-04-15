import { create } from "zustand";
import { User } from "@/types";
import {
  authService,
  AUTH_TOKEN_KEY,
  AUTH_USER_DISPLAY_KEY,
  AuthUserDisplay,
} from "@/services/auth.service";

/**
 * SEC-03 — Ephemeral auth state.
 *
 * The store holds `user` (full object incl. role) and `permissions` in memory
 * ONLY. Neither is ever persisted to localStorage. On page reload, the
 * `useAuthBootstrap` hook re-fetches `/auth/me` + `/auth/me/permissions` to
 * re-populate the store — this makes the backend the sole source of truth for
 * role and permissions (client cannot forge them via localStorage tampering).
 *
 * A minimal display cache (id, email, firstName, lastName, avatar) IS kept in
 * localStorage by `auth.service.ts` to avoid a blank flash before /auth/me
 * resolves. That cache must never carry role / permissions / isActive.
 */

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: string[];
  permissionsLoaded: boolean;
  /** Minimal hydrated display cache (no role, no permissions). Nullable. */
  displayCache: AuthUserDisplay | null;

  /** Replace in-memory auth state with a full user + permissions payload. */
  setAuth: (user: User, permissions: string[]) => void;

  /** @deprecated prefer setAuth. Kept for legacy callers (login/register/profile updates). */
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setPermissions: (perms: string[]) => void;
  clearPermissions: () => void;

  /** Wipe in-memory state AND localStorage token/display cache. */
  clear: () => void;

  logout: () => void;
  /**
   * Hydrate display cache + authenticated flag from localStorage only.
   * Does NOT populate role/permissions — those require a live /auth/me call
   * (done in useAuthBootstrap).
   */
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  permissions: [],
  permissionsLoaded: false,
  displayCache: null,

  setAuth: (user, permissions) =>
    set({
      user,
      isAuthenticated: true,
      permissions,
      permissionsLoaded: true,
      displayCache: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl ?? null,
        avatarPreset: user.avatarPreset ?? null,
      },
    }),

  setUser: (user) => {
    // NOTE: we deliberately do NOT persist the full user object anymore.
    // The display cache is refreshed from auth.service when the full user
    // payload comes from a server call (login/register/getProfile).
    set({
      user,
      isAuthenticated: !!user,
      displayCache: user
        ? {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl ?? null,
            avatarPreset: user.avatarPreset ?? null,
          }
        : null,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setPermissions: (perms) =>
    set({ permissions: perms, permissionsLoaded: true }),

  clearPermissions: () => set({ permissions: [], permissionsLoaded: false }),

  clear: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_DISPLAY_KEY);
      localStorage.removeItem("user"); // legacy
    }
    set({
      user: null,
      isAuthenticated: false,
      permissions: [],
      permissionsLoaded: false,
      displayCache: null,
      isLoading: false,
    });
  },

  logout: () => {
    authService.logout();
    set({
      user: null,
      isAuthenticated: false,
      permissions: [],
      permissionsLoaded: false,
      displayCache: null,
    });
  },

  checkAuth: () => {
    const display = authService.getDisplayCache();
    set({
      displayCache: display,
      isAuthenticated: authService.isAuthenticated(),
      isLoading: false,
    });
  },
}));
