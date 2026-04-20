import { useAuthStore } from "../auth.store";
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_DISPLAY_KEY,
} from "@/services/auth.service";
import type { User } from "@/types";

jest.mock("@/lib/api", () => ({
  api: { post: jest.fn(), get: jest.fn() },
}));

// localStorage mock
let store: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((k: string) => store[k] ?? null),
  setItem: jest.fn((k: string, v: string) => {
    store[k] = v;
  }),
  removeItem: jest.fn((k: string) => {
    delete store[k];
  }),
  clear: jest.fn(() => {
    store = {};
  }),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

const mockUser: User = {
  id: "u1",
  email: "u1@example.com",
  login: "u1",
  firstName: "Alice",
  lastName: "Doe",
  role: {
    id: "role-admin",
    code: "ADMIN",
    label: "Administrateur",
    templateKey: "ADMIN" as const,
    isSystem: true,
  }, // the interesting field — must NOT be persisted
  isActive: true,
  avatarUrl: null,
  avatarPreset: null,
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
};

describe("useAuthStore (SEC-03)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store = {};
    // Reset store to initial state between tests
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      permissions: [],
      permissionsLoaded: false,
      displayCache: null,
    });
  });

  describe("setAuth", () => {
    it("populates in-memory user + permissions but NEVER writes role to localStorage", () => {
      useAuthStore.getState().setAuth(mockUser, ["projects:read"]);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.permissions).toEqual(["projects:read"]);
      expect(state.isAuthenticated).toBe(true);
      expect(state.permissionsLoaded).toBe(true);

      // localStorage assertions — no "user" key, no role serialized
      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        "user",
        expect.anything(),
      );
      for (const [, value] of (localStorage.setItem as jest.Mock).mock.calls) {
        if (typeof value === "string") {
          expect(value).not.toContain('"role"');
          expect(value).not.toContain("ADMIN");
          expect(value).not.toContain('"permissions"');
        }
      }
    });

    it("sets the display cache (in-memory) with ONLY minimal fields", () => {
      useAuthStore.getState().setAuth(mockUser, ["x"]);
      const cache = useAuthStore.getState().displayCache;
      expect(cache).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        avatarUrl: null,
        avatarPreset: null,
      });
      expect(cache).not.toHaveProperty("role");
      expect(cache).not.toHaveProperty("permissions");
      expect(cache).not.toHaveProperty("isActive");
    });
  });

  describe("clear", () => {
    it("wipes token, display cache, legacy user key, and in-memory state", () => {
      store[AUTH_TOKEN_KEY] = "tok";
      store[AUTH_USER_DISPLAY_KEY] = "{}";
      store["user"] = "legacy-blob";

      useAuthStore.getState().setAuth(mockUser, ["a", "b"]);
      useAuthStore.getState().clear();

      expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        AUTH_USER_DISPLAY_KEY,
      );
      expect(localStorage.removeItem).toHaveBeenCalledWith("user");

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.permissions).toEqual([]);
      expect(state.permissionsLoaded).toBe(false);
      expect(state.displayCache).toBeNull();
    });
  });

  describe("setUser (legacy path)", () => {
    it("updates in-memory user and display cache WITHOUT writing user JSON to localStorage", () => {
      useAuthStore.getState().setUser(mockUser);

      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        "user",
        expect.anything(),
      );
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.displayCache?.id).toBe(mockUser.id);
      expect(state.displayCache).not.toHaveProperty("role");
    });

    it("setUser(null) resets state", () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().setUser(null);
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.displayCache).toBeNull();
    });
  });
});
