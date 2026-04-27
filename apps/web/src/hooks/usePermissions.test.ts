import { usePermissions } from "./usePermissions";
import { useAuthStore } from "@/stores/auth.store";
import { renderHook } from "@testing-library/react";

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
    const { hasPermission } = result.current;

    expect(hasPermission("projects:create")).toBe(true);
    expect(hasPermission("users:delete")).toBe(false);
  });

  it("should resolve solely from the permissions array (no role bypass)", () => {
    // Spec 3 V0 : plus de bypass isAdmin côté front. Les 107 permissions du
    // template ADMIN sont injectées via /api/auth/me/permissions.
    mockUseAuthStore.mockReturnValue({
      permissions: [],
      permissionsLoaded: true,
      user: { role: "ADMIN" },
    });

    const { result } = renderHook(() => usePermissions());
    const { hasPermission } = result.current;

    expect(hasPermission("projects:create")).toBe(false);
    expect(hasPermission("users:delete")).toBe(false);
  });

  it("grants every catalog code when permissions list contains them", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: ["projects:create", "users:delete"],
      permissionsLoaded: true,
      user: { role: "ADMIN" },
    });

    const { result } = renderHook(() => usePermissions());
    const { hasPermission } = result.current;

    expect(hasPermission("projects:create")).toBe(true);
    expect(hasPermission("users:delete")).toBe(true);
  });

  it("should support hasAnyPermission", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: ["tasks:read"],
      permissionsLoaded: true,
      user: { role: "CONTRIBUTEUR" },
    });

    const { result } = renderHook(() => usePermissions());
    const { hasAnyPermission } = result.current;

    expect(hasAnyPermission(["tasks:read", "tasks:create"])).toBe(true);
    expect(hasAnyPermission(["users:delete", "users:create"])).toBe(false);
  });

  it("should support hasAllPermissions", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: ["tasks:read", "tasks:create"],
      permissionsLoaded: true,
      user: { role: "CONTRIBUTEUR" },
    });

    const { result } = renderHook(() => usePermissions());
    const { hasAllPermissions } = result.current;

    expect(hasAllPermissions(["tasks:read", "tasks:create"])).toBe(true);
    expect(hasAllPermissions(["tasks:read", "users:delete"])).toBe(false);
  });

  it("should return permissionsLoaded state", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: [],
      permissionsLoaded: false,
      user: { role: "CONTRIBUTEUR" },
    });

    const { result } = renderHook(() => usePermissions());
    const { permissionsLoaded } = result.current;

    expect(permissionsLoaded).toBe(false);
  });

  it("should handle missing user gracefully", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: ["tasks:read"],
      permissionsLoaded: true,
      user: null,
    });

    const { result } = renderHook(() => usePermissions());
    const { hasPermission } = result.current;

    expect(hasPermission("tasks:read")).toBe(true);
    expect(hasPermission("users:delete")).toBe(false);
  });

  it("keeps permission helper identities stable while permissions do not change", () => {
    const storeState = {
      permissions: ["tasks:read"],
      permissionsLoaded: true,
      user: { role: "CONTRIBUTEUR" },
    };
    mockUseAuthStore.mockReturnValue(storeState);

    const { result, rerender } = renderHook(() => usePermissions());
    const firstHasPermission = result.current.hasPermission;
    const firstHasAnyPermission = result.current.hasAnyPermission;
    const firstHasAllPermissions = result.current.hasAllPermissions;

    rerender();

    expect(result.current.hasPermission).toBe(firstHasPermission);
    expect(result.current.hasAnyPermission).toBe(firstHasAnyPermission);
    expect(result.current.hasAllPermissions).toBe(firstHasAllPermissions);
  });
});
