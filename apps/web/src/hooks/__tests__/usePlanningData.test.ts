import { renderHook, waitFor } from "@testing-library/react";
import { usePlanningData } from "../usePlanningData";
import { tasksService } from "@/services/tasks.service";
import { usersService } from "@/services/users.service";
import { leavesService } from "@/services/leaves.service";
import { teleworkService } from "@/services/telework.service";
import { servicesService } from "@/services/services.service";
import { holidaysService } from "@/services/holidays.service";
import { Role, TaskStatus, Priority, LeaveStatus, LeaveType } from "@/types";

// Mock all services
jest.mock("@/services/tasks.service", () => ({
  tasksService: {
    getByDateRange: jest.fn(),
  },
}));

jest.mock("@/services/users.service", () => ({
  usersService: {
    getAll: jest.fn(),
  },
}));

jest.mock("@/services/leaves.service", () => ({
  leavesService: {
    getByDateRange: jest.fn(),
  },
}));

jest.mock("@/services/telework.service", () => ({
  teleworkService: {
    getByDateRange: jest.fn(),
  },
}));

jest.mock("@/services/services.service", () => ({
  servicesService: {
    getAll: jest.fn(),
  },
}));

jest.mock("@/services/holidays.service", () => ({
  holidaysService: {
    getByRange: jest.fn(),
  },
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("usePlanningData", () => {
  const mockUsers = [
    {
      id: "user-1",
      email: "dev@test.com",
      login: "dev",
      firstName: "John",
      lastName: "Dev",
      role: Role.CONTRIBUTEUR,
      isActive: true,
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
      userServices: [{ service: { id: "service-1", name: "Development" } }],
    },
    {
      id: "user-2",
      email: "manager@test.com",
      login: "manager",
      firstName: "Jane",
      lastName: "Manager",
      role: Role.MANAGER,
      isActive: true,
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
      userServices: [],
    },
    {
      id: "user-3",
      email: "inactive@test.com",
      login: "inactive",
      firstName: "Bob",
      lastName: "Inactive",
      role: Role.CONTRIBUTEUR,
      isActive: false,
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
      userServices: [],
    },
  ];

  const mockServices = [
    {
      id: "service-1",
      name: "Development",
      departmentId: "dept-1",
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    },
    {
      id: "service-2",
      name: "Marketing",
      departmentId: "dept-1",
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    },
  ];

  const mockTasks = [
    {
      id: "task-1",
      title: "Task 1",
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.NORMAL,
      projectId: "project-1",
      assigneeId: "user-1",
      progress: 50,
      endDate: new Date().toISOString(),
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    },
  ];

  const mockLeaves = [
    {
      id: "leave-1",
      userId: "user-1",
      type: LeaveType.CP,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      days: 1,
      status: LeaveStatus.APPROVED,
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    },
  ];

  const mockTelework = [
    {
      id: "tw-1",
      userId: "user-1",
      date: new Date().toISOString().split("T")[0],
      isTelework: true,
      isException: false,
      createdAt: "2025-01-01",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (usersService.getAll as jest.Mock).mockResolvedValue(mockUsers);
    (tasksService.getByDateRange as jest.Mock).mockResolvedValue(mockTasks);
    (leavesService.getByDateRange as jest.Mock).mockResolvedValue(mockLeaves);
    (teleworkService.getByDateRange as jest.Mock).mockResolvedValue(
      mockTelework,
    );
    (servicesService.getAll as jest.Mock).mockResolvedValue(mockServices);
    (holidaysService.getByRange as jest.Mock).mockResolvedValue([]);
  });

  it("should initialize with loading state", () => {
    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(),
        viewMode: "week",
      }),
    );

    expect(result.current.loading).toBe(true);
  });

  it("should fetch data and set loading to false", async () => {
    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(),
        viewMode: "week",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(usersService.getAll).toHaveBeenCalled();
    expect(tasksService.getByDateRange).toHaveBeenCalled();
    expect(leavesService.getByDateRange).toHaveBeenCalled();
    expect(teleworkService.getByDateRange).toHaveBeenCalled();
    expect(servicesService.getAll).toHaveBeenCalled();
  });

  it("should filter out inactive users", async () => {
    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(),
        viewMode: "week",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should only have active users (2 out of 3)
    expect(result.current.users).toHaveLength(2);
    expect(result.current.users.find((u) => u.id === "user-3")).toBeUndefined();
  });

  it("should generate 5 display days for week view", async () => {
    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(2025, 5, 15), // June 15, 2025 - a Sunday
        viewMode: "week",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.displayDays).toHaveLength(5); // Mon-Fri
  });

  it("should group users by service", async () => {
    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(),
        viewMode: "week",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have Encadrement group for manager
    const managementGroup = result.current.groupedUsers.find(
      (g) => g.id === "management",
    );
    expect(managementGroup).toBeDefined();
    expect(managementGroup?.isManagement).toBe(true);

    // Should have Development group for dev user
    const devGroup = result.current.groupedUsers.find(
      (g) => g.id === "service-1",
    );
    expect(devGroup).toBeDefined();
  });

  it("should filter groups by user id", async () => {
    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(),
        viewMode: "week",
        filterUserId: "user-1",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // filteredGroups should only contain the group with user-1
    const allUsers = result.current.filteredGroups.flatMap((g) => g.users);
    expect(allUsers).toHaveLength(1);
    expect(allUsers[0].id).toBe("user-1");
  });

  it("should get day cell data for a user", async () => {
    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(),
        viewMode: "week",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const today = new Date();
    const dayCell = result.current.getDayCell("user-1", today);

    expect(dayCell.date).toEqual(today);
    expect(Array.isArray(dayCell.tasks)).toBe(true);
    expect(Array.isArray(dayCell.leaves)).toBe(true);
    expect(typeof dayCell.isTelework).toBe("boolean");
  });

  it("should filter by availability view", async () => {
    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(),
        viewMode: "week",
        viewFilter: "availability",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const today = new Date();
    const dayCell = result.current.getDayCell("user-1", today);

    // In availability mode, tasks should be empty
    expect(dayCell.tasks).toHaveLength(0);
  });

  it("should filter by activity view", async () => {
    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(),
        viewMode: "week",
        viewFilter: "activity",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const today = new Date();
    const dayCell = result.current.getDayCell("user-1", today);

    // In activity mode, leaves should be empty and isTelework false
    expect(dayCell.leaves).toHaveLength(0);
    expect(dayCell.isTelework).toBe(false);
  });

  it("should count tasks per group", async () => {
    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(),
        viewMode: "week",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const devGroup = result.current.groupedUsers.find(
      (g) => g.id === "service-1",
    );
    if (devGroup) {
      const taskCount = result.current.getGroupTaskCount(devGroup.users);
      expect(taskCount).toBe(1); // One task assigned to user-1
    }
  });

  it("should have a refetch function", async () => {
    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(),
        viewMode: "week",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Just verify refetch is a function
    expect(typeof result.current.refetch).toBe("function");
  });

  it("should handle API errors gracefully", async () => {
    (usersService.getAll as jest.Mock).mockRejectedValue(
      new Error("API Error"),
    );

    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(),
        viewMode: "week",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should set empty arrays on error
    expect(result.current.users).toEqual([]);
    expect(result.current.tasks).toEqual([]);
  });

  it("should handle different data response formats", async () => {
    // Test with paginated response format
    (usersService.getAll as jest.Mock).mockResolvedValue({
      data: mockUsers,
      meta: { total: 3 },
    });

    const { result } = renderHook(() =>
      usePlanningData({
        currentDate: new Date(),
        viewMode: "week",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should still extract users correctly
    expect(result.current.users.length).toBeGreaterThan(0);
  });
});
