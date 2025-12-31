import { projectsService } from "../projects.service";
import { api } from "@/lib/api";
import { ProjectStatus, Priority } from "@/types";

jest.mock("@/lib/api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("projectsService", () => {
  const mockProject = {
    id: "project-1",
    name: "Test Project",
    description: "Test description",
    status: ProjectStatus.ACTIVE,
    priority: Priority.NORMAL,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    budgetHours: 1000,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  };

  const mockPaginatedResponse = {
    data: [mockProject],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  const mockStats = {
    totalTasks: 10,
    completedTasks: 5,
    inProgressTasks: 3,
    blockedTasks: 2,
    progress: 50,
    totalHours: 100,
    loggedHours: 50,
    remainingHours: 50,
    membersCount: 5,
    epicsCount: 2,
    milestonesCount: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAll", () => {
    it("should fetch all projects without filters", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      const result = await projectsService.getAll();

      expect(api.get).toHaveBeenCalledWith("/projects?");
      expect(result).toEqual(mockPaginatedResponse);
    });

    it("should fetch projects with pagination", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      await projectsService.getAll(1, 10);

      expect(api.get).toHaveBeenCalledWith("/projects?page=1&limit=10");
    });

    it("should filter by status", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      await projectsService.getAll(undefined, undefined, ProjectStatus.ACTIVE);

      expect(api.get).toHaveBeenCalledWith("/projects?status=ACTIVE");
    });

    it("should combine all parameters", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      await projectsService.getAll(2, 20, ProjectStatus.DRAFT);

      expect(api.get).toHaveBeenCalledWith(
        "/projects?page=2&limit=20&status=DRAFT",
      );
    });
  });

  describe("getById", () => {
    it("should fetch project by ID", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockProject });

      const result = await projectsService.getById("project-1");

      expect(api.get).toHaveBeenCalledWith("/projects/project-1");
      expect(result).toEqual(mockProject);
    });
  });

  describe("getByUser", () => {
    it("should fetch projects by user", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: [mockProject] });

      const result = await projectsService.getByUser("user-1");

      expect(api.get).toHaveBeenCalledWith("/projects/user/user-1");
      expect(result).toEqual([mockProject]);
    });
  });

  describe("getStats", () => {
    it("should fetch project stats", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const result = await projectsService.getStats("project-1");

      expect(api.get).toHaveBeenCalledWith("/projects/project-1/stats");
      expect(result).toEqual(mockStats);
    });
  });

  describe("create", () => {
    it("should create a new project", async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockProject });

      const createData = {
        name: "New Project",
        description: "New description",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      };

      const result = await projectsService.create(createData);

      expect(api.post).toHaveBeenCalledWith("/projects", createData);
      expect(result).toEqual(mockProject);
    });
  });

  describe("update", () => {
    it("should update a project", async () => {
      const updatedProject = { ...mockProject, name: "Updated Project" };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedProject });

      const result = await projectsService.update("project-1", {
        name: "Updated Project",
      });

      expect(api.patch).toHaveBeenCalledWith("/projects/project-1", {
        name: "Updated Project",
      });
      expect(result).toEqual(updatedProject);
    });
  });

  describe("delete", () => {
    it("should delete a project", async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await projectsService.delete("project-1");

      expect(api.delete).toHaveBeenCalledWith("/projects/project-1");
    });
  });

  describe("hardDelete", () => {
    it("should hard delete a project", async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await projectsService.hardDelete("project-1");

      expect(api.delete).toHaveBeenCalledWith("/projects/project-1/hard");
    });
  });

  describe("addMember", () => {
    it("should add a member to project", async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      const memberData = {
        userId: "user-1",
        role: "DEVELOPER",
        allocation: 100,
      };

      await projectsService.addMember("project-1", memberData);

      expect(api.post).toHaveBeenCalledWith(
        "/projects/project-1/members",
        memberData,
      );
    });
  });

  describe("removeMember", () => {
    it("should remove a member from project", async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await projectsService.removeMember("project-1", "user-1");

      expect(api.delete).toHaveBeenCalledWith(
        "/projects/project-1/members/user-1",
      );
    });
  });
});
