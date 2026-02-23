import { permissionsService } from "./permissions.service";
import { api } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  api: {
    get: jest.fn(),
  },
}));

describe("permissionsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getMyPermissions", () => {
    it("should fetch permissions from /auth/me/permissions", async () => {
      const permissions = ["projects:create", "tasks:read"];
      (api.get as jest.Mock).mockResolvedValue({
        data: { permissions },
      });

      const result = await permissionsService.getMyPermissions();

      expect(result).toEqual(permissions);
      expect(api.get).toHaveBeenCalledWith("/auth/me/permissions");
    });

    it("should return empty array when user has no permissions", async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: { permissions: [] },
      });

      const result = await permissionsService.getMyPermissions();

      expect(result).toEqual([]);
    });
  });
});
