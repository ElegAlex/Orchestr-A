import {
  authService,
  AUTH_TOKEN_KEY,
  AUTH_USER_DISPLAY_KEY,
} from "../auth.service";
import { api } from "@/lib/api";

// Mock de l'API
jest.mock("@/lib/api", () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
  },
  REFRESH_TOKEN_KEY: "refresh_token",
  ACCESS_TOKEN_KEY: "access_token",
}));

// Mock de localStorage
let localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => localStorageStore[key] || null),
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

describe("authService", () => {
  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    login: "testuser",
    firstName: "Test",
    lastName: "User",
    role: "CONTRIBUTEUR",
    isActive: true,
    avatarUrl: null,
    avatarPreset: null,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  };

  const mockAuthResponse = {
    access_token: "test-token-123",
    user: mockUser,
  };

  const expectedDisplayCache = JSON.stringify({
    id: mockUser.id,
    email: mockUser.email,
    firstName: mockUser.firstName,
    lastName: mockUser.lastName,
    avatarUrl: null,
    avatarPreset: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageStore = {};
  });

  describe("login", () => {
    it("should call API with credentials and store token + minimal display cache (no role)", async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      const result = await authService.login({
        login: "testuser",
        password: "password123",
      });

      expect(api.post).toHaveBeenCalledWith("/auth/login", {
        login: "testuser",
        password: "password123",
      });
      expect(localStorage.setItem).toHaveBeenCalledWith(
        AUTH_TOKEN_KEY,
        "test-token-123",
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        AUTH_USER_DISPLAY_KEY,
        expectedDisplayCache,
      );
      // SEC-03 — role MUST NOT leak into localStorage
      const allSetItemCalls = (localStorage.setItem as jest.Mock).mock.calls;
      for (const [, value] of allSetItemCalls) {
        if (typeof value === "string") {
          expect(value).not.toContain("CONTRIBUTEUR");
          expect(value).not.toContain('"role"');
          expect(value).not.toContain('"isActive"');
        }
      }
      // Legacy "user" key must NOT be written
      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        "user",
        expect.anything(),
      );
      expect(result).toEqual(mockAuthResponse);
    });

    it("should handle API errors", async () => {
      const error = new Error("Invalid credentials");
      (api.post as jest.Mock).mockRejectedValue(error);

      await expect(
        authService.login({ login: "wrong", password: "wrong" }),
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("register", () => {
    it("should call API with registration data and store token + display cache only", async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      const registerData = {
        email: "new@example.com",
        login: "newuser",
        password: "password123",
        firstName: "New",
        lastName: "User",
      };

      const result = await authService.register(registerData);

      expect(api.post).toHaveBeenCalledWith("/auth/register", registerData);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        AUTH_TOKEN_KEY,
        "test-token-123",
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        AUTH_USER_DISPLAY_KEY,
        expectedDisplayCache,
      );
      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        "user",
        expect.anything(),
      );
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe("getProfile", () => {
    it("should fetch profile and refresh display cache (not the full user)", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockUser });

      const result = await authService.getProfile();

      expect(api.get).toHaveBeenCalledWith("/auth/profile");
      expect(localStorage.setItem).toHaveBeenCalledWith(
        AUTH_USER_DISPLAY_KEY,
        expectedDisplayCache,
      );
      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        "user",
        expect.anything(),
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe("logout", () => {
    let originalLocation: Location;
    beforeAll(() => {
      originalLocation = window.location;
      // @ts-expect-error — replace location wholesale to avoid Cannot redefine
      delete window.location;
      // @ts-expect-error — stub minimal Location shape (test only reads/writes href)
      window.location = { href: "" };
    });
    afterAll(() => {
      // @ts-expect-error — restoring original Location instance
      window.location = originalLocation;
    });

    it("should call /auth/logout with refresh token and clear storage", async () => {
      localStorageStore["refresh_token"] = "rt-xyz";
      (api.post as jest.Mock).mockResolvedValue({ data: null });

      await authService.logout();

      expect(api.post).toHaveBeenCalledWith("/auth/logout", {
        refreshToken: "rt-xyz",
      });
      expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
      expect(localStorage.removeItem).toHaveBeenCalledWith("refresh_token");
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        AUTH_USER_DISPLAY_KEY,
      );
      expect(localStorage.removeItem).toHaveBeenCalledWith("user");
    });

    it("should still clear storage when server logout fails", async () => {
      localStorageStore["refresh_token"] = "rt-xyz";
      (api.post as jest.Mock).mockRejectedValue(new Error("network"));

      await authService.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
      expect(localStorage.removeItem).toHaveBeenCalledWith("refresh_token");
    });
  });

  describe("getDisplayCache", () => {
    it("should return parsed display cache when present", () => {
      localStorageStore[AUTH_USER_DISPLAY_KEY] = expectedDisplayCache;

      const result = authService.getDisplayCache();

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        avatarUrl: null,
        avatarPreset: null,
      });
      // Role absent from cache by construction
      expect(result).not.toHaveProperty("role");
      expect(result).not.toHaveProperty("permissions");
      expect(result).not.toHaveProperty("isActive");
    });

    it("should return null if cache missing or malformed", () => {
      expect(authService.getDisplayCache()).toBeNull();

      localStorageStore[AUTH_USER_DISPLAY_KEY] = "{not-json";
      expect(authService.getDisplayCache()).toBeNull();
    });
  });

  describe("isAuthenticated", () => {
    it("should return true if token exists", () => {
      localStorageMock.getItem.mockReturnValue("some-token");

      const result = authService.isAuthenticated();

      expect(localStorage.getItem).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
      expect(result).toBe(true);
    });

    it("should return false if no token", () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = authService.isAuthenticated();

      expect(result).toBe(false);
    });
  });
});
