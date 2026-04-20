import { renderHook } from "@testing-library/react";
import { usePermissions } from "./usePermissions";
import { useAuthStore } from "@/stores/auth.store";

jest.mock("@/stores/auth.store");

const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

describe("usePermissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return hasPermission that checks permissions array", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: ["projects:create", "tasks:read"],
      permissionsLoaded: true,
      user: { role: "CONTRIBUTEUR" },
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.hasPermission("projects:create")).toBe(true);
    expect(result.current.hasPermission("users:delete")).toBe(false);
  });

  it("should resolve solely from the permissions array (no role bypass)", () => {
    // Spec 3 V0 : plus de bypass isAdmin côté front. Les 108 permissions du
    // template ADMIN sont injectées via /api/auth/me/permissions.
    mockUseAuthStore.mockReturnValue({
      permissions: [],
      permissionsLoaded: true,
      user: { role: "ADMIN" },
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.hasPermission("projects:create")).toBe(false);
    expect(result.current.hasPermission("users:delete")).toBe(false);
  });

  it("grants every catalog code when permissions list contains them", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: ["projects:create", "users:delete"],
      permissionsLoaded: true,
      user: { role: "ADMIN" },
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.hasPermission("projects:create")).toBe(true);
    expect(result.current.hasPermission("users:delete")).toBe(true);
  });

  it("should support hasAnyPermission", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: ["tasks:read"],
      permissionsLoaded: true,
      user: { role: "CONTRIBUTEUR" },
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.hasAnyPermission(["tasks:read", "tasks:create"])).toBe(true);
    expect(result.current.hasAnyPermission(["users:delete", "users:create"])).toBe(false);
  });

  it("should support hasAllPermissions", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: ["tasks:read", "tasks:create"],
      permissionsLoaded: true,
      user: { role: "CONTRIBUTEUR" },
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.hasAllPermissions(["tasks:read", "tasks:create"])).toBe(true);
    expect(result.current.hasAllPermissions(["tasks:read", "users:delete"])).toBe(false);
  });

  it("should return permissionsLoaded state", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: [],
      permissionsLoaded: false,
      user: { role: "CONTRIBUTEUR" },
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.permissionsLoaded).toBe(false);
  });

  it("should handle missing user gracefully", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: ["tasks:read"],
      permissionsLoaded: true,
      user: null,
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.hasPermission("tasks:read")).toBe(true);
    expect(result.current.hasPermission("users:delete")).toBe(false);
  });
});
