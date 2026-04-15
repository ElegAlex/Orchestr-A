import { renderHook, waitFor } from "@testing-library/react";
import { useAuthBootstrap } from "../useAuthBootstrap";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import { AUTH_TOKEN_KEY } from "@/services/auth.service";
import { Role } from "@/types";

jest.mock("@/lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

let store: Record<string, string> = {};
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  },
  writable: true,
});

const mockUser = {
  id: "u1",
  email: "u1@x",
  login: "u1",
  firstName: "A",
  lastName: "B",
  role: Role.MANAGER,
  isActive: true,
  avatarUrl: null,
  avatarPreset: null,
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
};

describe("useAuthBootstrap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store = {};
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      permissions: [],
      permissionsLoaded: false,
      displayCache: null,
    });
  });

  it("returns ready=true immediately when no token is present", async () => {
    const { result } = renderHook(() => useAuthBootstrap());
    await waitFor(() => expect(result.current).toBe(true));
    expect(api.get).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("fetches /auth/me + /auth/me/permissions and populates the store when a token exists", async () => {
    store[AUTH_TOKEN_KEY] = "valid-token";
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === "/auth/me") return Promise.resolve({ data: mockUser });
      if (url === "/auth/me/permissions")
        return Promise.resolve({ data: { permissions: ["projects:read"] } });
      return Promise.reject(new Error("unexpected " + url));
    });

    const { result } = renderHook(() => useAuthBootstrap());
    await waitFor(() => expect(result.current).toBe(true));

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.permissions).toEqual(["projects:read"]);
    expect(state.isAuthenticated).toBe(true);
    expect(state.permissionsLoaded).toBe(true);
  });

  it("clears the store when the bootstrap requests fail (e.g. stale token)", async () => {
    store[AUTH_TOKEN_KEY] = "stale-token";
    (api.get as jest.Mock).mockRejectedValue({
      response: { status: 401 },
    });

    // Pre-populate to verify the clear happens
    useAuthStore.getState().setAuth(mockUser, ["x"]);

    const { result } = renderHook(() => useAuthBootstrap());
    await waitFor(() => expect(result.current).toBe(true));

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.permissions).toEqual([]);
  });
});
