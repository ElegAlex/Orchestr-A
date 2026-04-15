import { api } from "@/lib/api";
import { AuthResponse, LoginDto, RegisterDto, User } from "@/types";

/**
 * SEC-03 — Security-sensitive notes
 *
 * Only `access_token` (JWT) is persisted in localStorage (conscious project choice).
 * The FULL user object (including `role`, `isActive`, `permissions`, etc.) is NEVER
 * persisted. Persisting role client-side allows trivial privilege escalation by
 * tampering with localStorage, and the frontend UI would branch on the mutated
 * value. Backend guards (RolesGuard / PermissionsGuard) are the authoritative
 * source of truth; the frontend simply mirrors the server state in ephemeral
 * Zustand memory (rehydrated from /auth/me + /auth/me/permissions at bootstrap).
 *
 * We keep a minimal DISPLAY-ONLY cache in localStorage under `auth_user_display`
 * so the initial render (before /auth/me resolves) can show a name/avatar without
 * a blank flash. This cache MUST NOT contain role, permissions, isActive, or any
 * authorization-relevant flag.
 */

export const AUTH_TOKEN_KEY = "access_token";
export const AUTH_USER_DISPLAY_KEY = "auth_user_display";

export interface AuthUserDisplay {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
}

function toDisplayCache(user: User): AuthUserDisplay {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl ?? null,
    avatarPreset: user.avatarPreset ?? null,
  };
}

function persistSession(token: string, user: User) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(
    AUTH_USER_DISPLAY_KEY,
    JSON.stringify(toDisplayCache(user)),
  );
}

export const authService = {
  async login(credentials: LoginDto): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/login", credentials);
    if (response.data.access_token) {
      persistSession(response.data.access_token, response.data.user);
    }
    return response.data;
  },

  async register(data: RegisterDto): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/register", data);
    if (response.data.access_token) {
      persistSession(response.data.access_token, response.data.user);
    }
    return response.data;
  },

  async getProfile(): Promise<User> {
    const response = await api.get<User>("/auth/profile");
    // Refresh the display cache from the authoritative server payload
    localStorage.setItem(
      AUTH_USER_DISPLAY_KEY,
      JSON.stringify(toDisplayCache(response.data)),
    );
    return response.data;
  },

  logout(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_DISPLAY_KEY);
    // Legacy key cleanup — earlier builds persisted the full user object.
    localStorage.removeItem("user");
    window.location.href = "/login";
  },

  /**
   * Returns the minimal display cache (id/email/name/avatar).
   * NEVER contains role or permissions — do NOT use for authorization.
   */
  getDisplayCache(): AuthUserDisplay | null {
    const raw = localStorage.getItem(AUTH_USER_DISPLAY_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUserDisplay;
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem(AUTH_TOKEN_KEY);
  },
};
