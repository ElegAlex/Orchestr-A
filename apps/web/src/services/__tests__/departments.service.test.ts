import { departmentsService } from "../departments.service";
import { api } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("departmentsService", () => {
  const mockDepartment = {
    id: "dept-1",
    name: "IT Department",
    description: "Information Technology",
    managerId: "user-1",
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  };

  const mockDepartments = [
    mockDepartment,
    { ...mockDepartment, id: "dept-2", name: "HR Department" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAll", () => {
    it("should fetch all departments from wrapped response", async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: { data: mockDepartments },
      });

      const result = await departmentsService.getAll();

      expect(api.get).toHaveBeenCalledWith("/departments");
      expect(result).toEqual(mockDepartments);
    });

    it("should handle direct array response", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockDepartments });

      const result = await departmentsService.getAll();

      expect(result).toEqual(mockDepartments);
    });

    it("should return empty array for invalid response", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: null });

      const result = await departmentsService.getAll();

      expect(result).toEqual([]);
    });
  });

  describe("getById", () => {
    it("should fetch department by ID", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockDepartment });

      const result = await departmentsService.getById("dept-1");

      expect(api.get).toHaveBeenCalledWith("/departments/dept-1");
      expect(result).toEqual(mockDepartment);
    });
  });

  describe("create", () => {
    it("should create a new department", async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockDepartment });

      const createData = {
        name: "New Department",
        description: "New description",
      };

      const result = await departmentsService.create(createData);

      expect(api.post).toHaveBeenCalledWith("/departments", createData);
      expect(result).toEqual(mockDepartment);
    });
  });

  describe("update", () => {
    it("should update a department", async () => {
      const updatedDept = { ...mockDepartment, name: "Updated Department" };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedDept });

      const result = await departmentsService.update("dept-1", {
        name: "Updated Department",
      });

      expect(api.patch).toHaveBeenCalledWith("/departments/dept-1", {
        name: "Updated Department",
      });
      expect(result).toEqual(updatedDept);
    });
  });

  describe("delete", () => {
    it("should delete a department", async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await departmentsService.delete("dept-1");

      expect(api.delete).toHaveBeenCalledWith("/departments/dept-1");
    });
  });

  describe("getStats", () => {
    it("should fetch department stats", async () => {
      const mockStats = { servicesCount: 5, membersCount: 25 };
      (api.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const result = await departmentsService.getStats("dept-1");

      expect(api.get).toHaveBeenCalledWith("/departments/dept-1/stats");
      expect(result).toEqual(mockStats);
    });
  });
});
