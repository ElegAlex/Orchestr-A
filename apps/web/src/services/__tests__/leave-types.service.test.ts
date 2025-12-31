import { leaveTypesService } from "../leave-types.service";
import { api } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("leaveTypesService", () => {
  const mockLeaveType = {
    id: "lt-1",
    code: "CP",
    name: "Congés payés",
    description: "Congés payés annuels",
    color: "#4CAF50",
    icon: "vacation",
    isPaid: true,
    requiresApproval: true,
    maxDaysPerYear: 25,
    isActive: true,
    isSystem: true,
    sortOrder: 1,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  };

  const mockLeaveTypes = [
    mockLeaveType,
    { ...mockLeaveType, id: "lt-2", code: "RTT", name: "RTT" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAll", () => {
    it("should fetch all active leave types by default", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockLeaveTypes });

      const result = await leaveTypesService.getAll();

      expect(api.get).toHaveBeenCalledWith("/leave-types");
      expect(result).toEqual(mockLeaveTypes);
    });

    it("should include inactive leave types when requested", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockLeaveTypes });

      const result = await leaveTypesService.getAll(true);

      expect(api.get).toHaveBeenCalledWith("/leave-types?includeInactive=true");
      expect(result).toEqual(mockLeaveTypes);
    });
  });

  describe("getById", () => {
    it("should fetch leave type by ID", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockLeaveType });

      const result = await leaveTypesService.getById("lt-1");

      expect(api.get).toHaveBeenCalledWith("/leave-types/lt-1");
      expect(result).toEqual(mockLeaveType);
    });
  });

  describe("getByCode", () => {
    it("should fetch leave type by code", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockLeaveType });

      const result = await leaveTypesService.getByCode("CP");

      expect(api.get).toHaveBeenCalledWith("/leave-types/code/CP");
      expect(result).toEqual(mockLeaveType);
    });
  });

  describe("create", () => {
    it("should create a new leave type", async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockLeaveType });

      const createData = {
        code: "CP",
        name: "Congés payés",
        description: "Congés payés annuels",
        color: "#4CAF50",
        isPaid: true,
        requiresApproval: true,
        maxDaysPerYear: 25,
      };

      const result = await leaveTypesService.create(createData);

      expect(api.post).toHaveBeenCalledWith("/leave-types", createData);
      expect(result).toEqual(mockLeaveType);
    });
  });

  describe("update", () => {
    it("should update a leave type", async () => {
      const updatedLeaveType = { ...mockLeaveType, name: "Updated Leave Type" };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedLeaveType });

      const result = await leaveTypesService.update("lt-1", {
        name: "Updated Leave Type",
      });

      expect(api.patch).toHaveBeenCalledWith("/leave-types/lt-1", {
        name: "Updated Leave Type",
      });
      expect(result).toEqual(updatedLeaveType);
    });

    it("should update leave type active status", async () => {
      const updatedLeaveType = { ...mockLeaveType, isActive: false };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedLeaveType });

      const result = await leaveTypesService.update("lt-1", {
        isActive: false,
      });

      expect(api.patch).toHaveBeenCalledWith("/leave-types/lt-1", {
        isActive: false,
      });
      expect(result).toEqual(updatedLeaveType);
    });
  });

  describe("delete", () => {
    it("should delete a leave type and return result", async () => {
      const deleteResponse = { message: "Leave type deleted", deleted: true };
      (api.delete as jest.Mock).mockResolvedValue({ data: deleteResponse });

      const result = await leaveTypesService.delete("lt-1");

      expect(api.delete).toHaveBeenCalledWith("/leave-types/lt-1");
      expect(result).toEqual(deleteResponse);
    });

    it("should handle deactivation instead of deletion", async () => {
      const deleteResponse = {
        message: "Leave type deactivated",
        deactivated: true,
      };
      (api.delete as jest.Mock).mockResolvedValue({ data: deleteResponse });

      const result = await leaveTypesService.delete("lt-1");

      expect(result).toEqual(deleteResponse);
    });
  });

  describe("reorder", () => {
    it("should reorder leave types", async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockLeaveTypes });

      const orderedIds = ["lt-2", "lt-1"];

      const result = await leaveTypesService.reorder(orderedIds);

      expect(api.post).toHaveBeenCalledWith("/leave-types/reorder", {
        orderedIds,
      });
      expect(result).toEqual(mockLeaveTypes);
    });
  });
});
