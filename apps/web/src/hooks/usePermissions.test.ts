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

    const { hasPermission } = usePermissions();

    expect(hasPermission("projects:create")).toBe(true);
    expect(hasPermission("users:delete")).toBe(false);
  });

  it("should grant all permissions for ADMIN role", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: [],
      permissionsLoaded: true,
      user: { role: "ADMIN" },
    });

    const { hasPermission } = usePermissions();

    expect(hasPermission("projects:create")).toBe(true);
    expect(hasPermission("users:delete")).toBe(true);
    expect(hasPermission("anything:at_all")).toBe(true);
  });

  it("should support hasAnyPermission", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: ["tasks:read"],
      permissionsLoaded: true,
      user: { role: "CONTRIBUTEUR" },
    });

    const { hasAnyPermission } = usePermissions();

    expect(hasAnyPermission(["tasks:read", "tasks:create"])).toBe(true);
    expect(hasAnyPermission(["users:delete", "users:create"])).toBe(false);
  });

  it("should support hasAllPermissions", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: ["tasks:read", "tasks:create"],
      permissionsLoaded: true,
      user: { role: "CONTRIBUTEUR" },
    });

    const { hasAllPermissions } = usePermissions();

    expect(hasAllPermissions(["tasks:read", "tasks:create"])).toBe(true);
    expect(hasAllPermissions(["tasks:read", "users:delete"])).toBe(false);
  });

  it("should return permissionsLoaded state", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: [],
      permissionsLoaded: false,
      user: { role: "CONTRIBUTEUR" },
    });

    const { permissionsLoaded } = usePermissions();

    expect(permissionsLoaded).toBe(false);
  });

  it("should handle missing user gracefully", () => {
    mockUseAuthStore.mockReturnValue({
      permissions: ["tasks:read"],
      permissionsLoaded: true,
      user: null,
    });

    const { hasPermission } = usePermissions();

    expect(hasPermission("tasks:read")).toBe(true);
    expect(hasPermission("users:delete")).toBe(false);
  });
});
