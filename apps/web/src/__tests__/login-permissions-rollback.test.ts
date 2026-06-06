/**
 * COR-041 — Login page: token rolled back when permissions fetch fails.
 *
 * Tests the handler logic in isolation: mock authService.login (persists token
 * to localStorage) + api.get('/auth/me/permissions') (rejects), then verify:
 *   1. localStorage no longer holds the access_token.
 *   2. useAuthStore reflects a logged-out state.
 */

import { authService, AUTH_TOKEN_KEY, AUTH_USER_DISPLAY_KEY } from "../services/auth.service";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";

// Mock the api module only — authService runs as-is so that persistSession
// actually writes to localStorage (the behavior we want to verify rolling back).
jest.mock("@/lib/api", () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
  },
  REFRESH_TOKEN_KEY: "refresh_token",
  ACCESS_TOKEN_KEY: "access_token",
}));

// localStorage mock
let localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => localStorageStore[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: jest.fn(() => {
    localStorageStore = {};
  }),
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// ---------------------------------------------------------------------------
// Inline handler — mirrors the handleSubmit in login/page.tsx and
// register/page.tsx exactly, allowing unit testing without rendering
// the full App-Router page (which requires next-intl, next/navigation, etc.).
// ---------------------------------------------------------------------------
async function loginHandlerWithRollback(
  credentials: { login: string; password: string },
  onSuccess: () => void,
  onError: (msg: string) => void,
) {
  const { setAuth, clear } = useAuthStore.getState();
  try {
    const response = await authService.login(credentials);
    try {
      const permsRes = await api.get<{ permissions: string[] }>(
        "/auth/me/permissions",
      );
      setAuth(response.user, permsRes.data.permissions);
      onSuccess();
    } catch {
      clear();
      onError("generic");
    }
  } catch (err: unknown) {
    const axiosError = err as { response?: { data?: { message?: string } } };
    onError(axiosError.response?.data?.message ?? "generic");
  }
}

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  login: "testuser",
  firstName: "Test",
  lastName: "User",
  role: {
    id: "role-contrib",
    code: "CONTRIBUTEUR",
    label: "Contributeur",
    templateKey: "CONTRIBUTOR" as const,
    isSystem: true,
  },
  isActive: true,
  avatarUrl: null,
  avatarPreset: null,
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
};

const mockAuthResponse = {
  access_token: "test-token-from-login",
  user: mockUser,
};

describe("COR-041 — login page: permissions-fetch failure rolls back the persisted token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageStore = {};
    // Reset Zustand to initial state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      permissions: [],
      permissionsLoaded: false,
      displayCache: null,
      isLoading: true,
    });
  });

  it("rolls back the token and reports error when permissions fetch fails", async () => {
    // authService.login will call persistSession (writes access_token to LS)
    (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });
    // permissions fetch fails
    (api.get as jest.Mock).mockRejectedValue(new Error("Network error"));

    const successSpy = jest.fn();
    const errorSpy = jest.fn();

    await loginHandlerWithRollback(
      { login: "testuser", password: "password123" },
      successSpy,
      errorSpy,
    );

    // Token must be removed from localStorage
    expect(localStorageStore[AUTH_TOKEN_KEY]).toBeUndefined();
    // Display cache must be removed
    expect(localStorageStore[AUTH_USER_DISPLAY_KEY]).toBeUndefined();
    // Store must reflect unauthenticated state
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    // Error callback must have fired
    expect(errorSpy).toHaveBeenCalledWith("generic");
    expect(successSpy).not.toHaveBeenCalled();
  });

  it("completes login and does NOT roll back when permissions fetch succeeds", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });
    (api.get as jest.Mock).mockResolvedValue({
      data: { permissions: ["projects:read", "tasks:read"] },
    });

    const successSpy = jest.fn();
    const errorSpy = jest.fn();

    await loginHandlerWithRollback(
      { login: "testuser", password: "password123" },
      successSpy,
      errorSpy,
    );

    expect(localStorageStore[AUTH_TOKEN_KEY]).toBe("test-token-from-login");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().permissions).toEqual(["projects:read", "tasks:read"]);
    expect(successSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("reports error (no rollback needed) when login itself fails", async () => {
    const loginError = {
      response: { data: { message: "Invalid credentials" } },
    };
    (api.post as jest.Mock).mockRejectedValue(loginError);

    const successSpy = jest.fn();
    const errorSpy = jest.fn();

    await loginHandlerWithRollback(
      { login: "wrong", password: "wrong" },
      successSpy,
      errorSpy,
    );

    // No token was ever set (login failed before persistSession)
    expect(localStorageStore[AUTH_TOKEN_KEY]).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith("Invalid credentials");
    expect(successSpy).not.toHaveBeenCalled();
  });
});
