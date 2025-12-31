import { usersService } from "../users.service";
import { api } from "@/lib/api";
import { Role } from "@/types";

jest.mock("@/lib/api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("usersService", () => {
  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    login: "testuser",
    firstName: "Test",
    lastName: "User",
    role: Role.CONTRIBUTEUR,
    isActive: true,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  };

  const mockUsers = [
    mockUser,
    { ...mockUser, id: "user-2", email: "test2@example.com" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAll", () => {
    it("should fetch all users without pagination", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { data: mockUsers } });

      const result = await usersService.getAll();

      expect(api.get).toHaveBeenCalledWith("/users?");
      expect(result).toEqual(mockUsers);
    });

    it("should fetch users with pagination", async () => {
      const paginatedResponse = {
        data: mockUsers,
        total: 10,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      (api.get as jest.Mock).mockResolvedValue({ data: paginatedResponse });

      const result = await usersService.getAll(1, 10);

      expect(api.get).toHaveBeenCalledWith("/users?page=1&limit=10");
      expect(result).toEqual(paginatedResponse);
    });

    it("should filter by role", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: { data: mockUsers } });

      await usersService.getAll(undefined, undefined, Role.ADMIN);

      expect(api.get).toHaveBeenCalledWith("/users?role=ADMIN");
    });

    it("should handle direct array response", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockUsers });

      const result = await usersService.getAll();

      expect(result).toEqual(mockUsers);
    });

    it("should return empty array for invalid response", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: null });

      const result = await usersService.getAll();

      expect(result).toEqual([]);
    });
  });

  describe("getById", () => {
    it("should fetch user by ID", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockUser });

      const result = await usersService.getById("user-1");

      expect(api.get).toHaveBeenCalledWith("/users/user-1");
      expect(result).toEqual(mockUser);
    });
  });

  describe("getByDepartment", () => {
    it("should fetch users by department", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockUsers });

      const result = await usersService.getByDepartment("dept-1");

      expect(api.get).toHaveBeenCalledWith("/users/department/dept-1");
      expect(result).toEqual(mockUsers);
    });
  });

  describe("getByService", () => {
    it("should fetch users by service", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockUsers });

      const result = await usersService.getByService("service-1");

      expect(api.get).toHaveBeenCalledWith("/users/service/service-1");
      expect(result).toEqual(mockUsers);
    });
  });

  describe("getByRole", () => {
    it("should fetch users by role", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockUsers });

      const result = await usersService.getByRole(Role.MANAGER);

      expect(api.get).toHaveBeenCalledWith("/users/role/MANAGER");
      expect(result).toEqual(mockUsers);
    });
  });

  describe("create", () => {
    it("should create a new user", async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockUser });

      const userData = {
        email: "new@example.com",
        login: "newuser",
        password: "password123",
        firstName: "New",
        lastName: "User",
      };

      const result = await usersService.create(userData);

      expect(api.post).toHaveBeenCalledWith("/users", userData);
      expect(result).toEqual(mockUser);
    });
  });

  describe("update", () => {
    it("should update a user", async () => {
      const updatedUser = { ...mockUser, firstName: "Updated" };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedUser });

      const result = await usersService.update("user-1", {
        firstName: "Updated",
      });

      expect(api.patch).toHaveBeenCalledWith("/users/user-1", {
        firstName: "Updated",
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe("delete", () => {
    it("should delete a user", async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await usersService.delete("user-1");

      expect(api.delete).toHaveBeenCalledWith("/users/user-1");
    });
  });

  describe("changePassword", () => {
    it("should change user password", async () => {
      (api.patch as jest.Mock).mockResolvedValue({});

      await usersService.changePassword({
        currentPassword: "old123",
        newPassword: "new456",
      });

      expect(api.patch).toHaveBeenCalledWith("/users/me/change-password", {
        currentPassword: "old123",
        newPassword: "new456",
      });
    });
  });

  describe("resetPassword", () => {
    it("should reset user password", async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await usersService.resetPassword("user-1", "newpassword123");

      expect(api.post).toHaveBeenCalledWith("/users/user-1/reset-password", {
        newPassword: "newpassword123",
      });
    });
  });
});
