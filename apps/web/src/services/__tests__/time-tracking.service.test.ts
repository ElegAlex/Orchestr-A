import { timeTrackingService } from "../time-tracking.service";
import { api } from "@/lib/api";
import { ActivityType } from "@/types";

jest.mock("@/lib/api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("timeTrackingService", () => {
  const mockTimeEntry = {
    id: "entry-1",
    userId: "user-1",
    projectId: "project-1",
    taskId: "task-1",
    date: "2025-06-15",
    hours: 4,
    description: "Development work",
    activityType: ActivityType.DEVELOPMENT,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  };

  const mockTimeEntries = [
    mockTimeEntry,
    { ...mockTimeEntry, id: "entry-2", hours: 2 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAll", () => {
    it("should fetch all time entries from wrapped response", async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: { data: mockTimeEntries },
      });

      const result = await timeTrackingService.getAll();

      expect(api.get).toHaveBeenCalledWith("/time-tracking");
      expect(result).toEqual(mockTimeEntries);
    });

    it("should handle direct array response", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTimeEntries });

      const result = await timeTrackingService.getAll();

      expect(result).toEqual(mockTimeEntries);
    });

    it("should return empty array for invalid response", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: null });

      const result = await timeTrackingService.getAll();

      expect(result).toEqual([]);
    });
  });

  describe("getById", () => {
    it("should fetch time entry by ID", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTimeEntry });

      const result = await timeTrackingService.getById("entry-1");

      expect(api.get).toHaveBeenCalledWith("/time-tracking/entry-1");
      expect(result).toEqual(mockTimeEntry);
    });
  });

  describe("getByUser", () => {
    it("should fetch time entries by user without date range", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTimeEntries });

      const result = await timeTrackingService.getByUser("user-1");

      expect(api.get).toHaveBeenCalledWith("/time-tracking/user/user-1?");
      expect(result).toEqual(mockTimeEntries);
    });

    it("should fetch time entries by user with date range", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTimeEntries });

      const result = await timeTrackingService.getByUser(
        "user-1",
        "2025-01-01",
        "2025-12-31",
      );

      expect(api.get).toHaveBeenCalledWith(
        "/time-tracking/user/user-1?startDate=2025-01-01&endDate=2025-12-31",
      );
      expect(result).toEqual(mockTimeEntries);
    });
  });

  describe("getMyEntries", () => {
    it("should fetch current user time entries without date range", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTimeEntries });

      const result = await timeTrackingService.getMyEntries();

      expect(api.get).toHaveBeenCalledWith("/time-tracking/me?");
      expect(result).toEqual(mockTimeEntries);
    });

    it("should fetch current user time entries with date range", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTimeEntries });

      const result = await timeTrackingService.getMyEntries(
        "2025-06-01",
        "2025-06-30",
      );

      expect(api.get).toHaveBeenCalledWith(
        "/time-tracking/me?startDate=2025-06-01&endDate=2025-06-30",
      );
      expect(result).toEqual(mockTimeEntries);
    });
  });

  describe("getByProject", () => {
    it("should fetch time entries by project without date range", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTimeEntries });

      const result = await timeTrackingService.getByProject("project-1");

      expect(api.get).toHaveBeenCalledWith("/time-tracking/project/project-1?");
      expect(result).toEqual(mockTimeEntries);
    });

    it("should fetch time entries by project with date range", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTimeEntries });

      const result = await timeTrackingService.getByProject(
        "project-1",
        "2025-01-01",
        "2025-06-30",
      );

      expect(api.get).toHaveBeenCalledWith(
        "/time-tracking/project/project-1?startDate=2025-01-01&endDate=2025-06-30",
      );
      expect(result).toEqual(mockTimeEntries);
    });
  });

  describe("getByTask", () => {
    it("should fetch time entries by task", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTimeEntries });

      const result = await timeTrackingService.getByTask("task-1");

      expect(api.get).toHaveBeenCalledWith("/time-tracking/task/task-1");
      expect(result).toEqual(mockTimeEntries);
    });
  });

  describe("create", () => {
    it("should create a new time entry", async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockTimeEntry });

      const createData = {
        projectId: "project-1",
        taskId: "task-1",
        date: "2025-06-15",
        hours: 4,
        description: "Development work",
        activityType: ActivityType.DEVELOPMENT,
      };

      const result = await timeTrackingService.create(createData);

      expect(api.post).toHaveBeenCalledWith("/time-tracking", createData);
      expect(result).toEqual(mockTimeEntry);
    });
  });

  describe("update", () => {
    it("should update a time entry", async () => {
      const updatedEntry = { ...mockTimeEntry, hours: 6 };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedEntry });

      const result = await timeTrackingService.update("entry-1", { hours: 6 });

      expect(api.patch).toHaveBeenCalledWith("/time-tracking/entry-1", {
        hours: 6,
      });
      expect(result).toEqual(updatedEntry);
    });
  });

  describe("delete", () => {
    it("should delete a time entry", async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await timeTrackingService.delete("entry-1");

      expect(api.delete).toHaveBeenCalledWith("/time-tracking/entry-1");
    });
  });

  describe("getStats", () => {
    it("should fetch user stats without date range", async () => {
      const mockStats = { totalHours: 40, byProject: {} };
      (api.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const result = await timeTrackingService.getStats("user-1");

      expect(api.get).toHaveBeenCalledWith("/time-tracking/user/user-1/stats?");
      expect(result).toEqual(mockStats);
    });

    it("should fetch user stats with date range", async () => {
      const mockStats = { totalHours: 160, byProject: {} };
      (api.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const result = await timeTrackingService.getStats(
        "user-1",
        "2025-01-01",
        "2025-01-31",
      );

      expect(api.get).toHaveBeenCalledWith(
        "/time-tracking/user/user-1/stats?startDate=2025-01-01&endDate=2025-01-31",
      );
      expect(result).toEqual(mockStats);
    });
  });
});
