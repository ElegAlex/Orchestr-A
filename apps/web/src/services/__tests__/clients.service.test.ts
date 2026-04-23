import { clientsService } from "../clients.service";
import { api } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("clientsService", () => {
  const mockClient = {
    id: "client-1",
    name: "Mairie de Lyon",
    isActive: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    _count: { projects: 3 },
  };

  const mockPaginatedResponse = {
    data: [mockClient],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAll", () => {
    it("should fetch all clients with no query params", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      const result = await clientsService.getAll();

      expect(api.get).toHaveBeenCalledWith("/clients?");
      expect(result).toEqual(mockPaginatedResponse);
    });

    it("should append search param when provided", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      await clientsService.getAll({ search: "Lyon" });

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("search=Lyon"),
      );
    });

    it("should append isActive param when provided", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      await clientsService.getAll({ isActive: true });

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("isActive=true"),
      );
    });

    it("should append pagination params when provided", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

      await clientsService.getAll({ page: 2, limit: 50 });

      const callArg = (api.get as jest.Mock).mock.calls[0][0] as string;
      expect(callArg).toContain("page=2");
      expect(callArg).toContain("limit=50");
    });
  });

  describe("getById", () => {
    it("should fetch a client by ID", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockClient });

      const result = await clientsService.getById("client-1");

      expect(api.get).toHaveBeenCalledWith("/clients/client-1");
      expect(result).toEqual(mockClient);
    });
  });

  describe("getDeletionImpact", () => {
    it("should fetch deletion impact for a client", async () => {
      const mockImpact = { projectsCount: 2 };
      (api.get as jest.Mock).mockResolvedValue({ data: mockImpact });

      const result = await clientsService.getDeletionImpact("client-1");

      expect(api.get).toHaveBeenCalledWith(
        "/clients/client-1/deletion-impact",
      );
      expect(result).toEqual(mockImpact);
    });
  });

  describe("getProjectsWithSummary", () => {
    it("should fetch client projects with summary", async () => {
      const mockProjectsResponse = {
        projects: [
          {
            id: "proj-1",
            name: "Projet Test",
            status: "ACTIVE",
            manager: { id: "user-1", firstName: "Alice", lastName: "Martin" },
            startDate: "2025-01-01",
            endDate: "2025-12-31",
            budgetHours: 100,
            hoursLogged: 60,
          },
        ],
        summary: {
          projectsActive: 1,
          projectsTotal: 1,
          budgetHoursTotal: 100,
          hoursLoggedTotal: 60,
          varianceHours: 40,
        },
      };
      (api.get as jest.Mock).mockResolvedValue({ data: mockProjectsResponse });

      const result = await clientsService.getProjectsWithSummary("client-1");

      expect(api.get).toHaveBeenCalledWith("/clients/client-1/projects");
      expect(result).toEqual(mockProjectsResponse);
    });
  });

  describe("create", () => {
    it("should create a new client", async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockClient });

      const result = await clientsService.create({ name: "Mairie de Lyon" });

      expect(api.post).toHaveBeenCalledWith("/clients", { name: "Mairie de Lyon" });
      expect(result).toEqual(mockClient);
    });
  });

  describe("update", () => {
    it("should update a client", async () => {
      const updated = { ...mockClient, name: "Grand Lyon Métropole" };
      (api.patch as jest.Mock).mockResolvedValue({ data: updated });

      const result = await clientsService.update("client-1", {
        name: "Grand Lyon Métropole",
      });

      expect(api.patch).toHaveBeenCalledWith("/clients/client-1", {
        name: "Grand Lyon Métropole",
      });
      expect(result).toEqual(updated);
    });

    it("should archive a client by setting isActive to false", async () => {
      const archived = { ...mockClient, isActive: false };
      (api.patch as jest.Mock).mockResolvedValue({ data: archived });

      const result = await clientsService.update("client-1", {
        isActive: false,
      });

      expect(api.patch).toHaveBeenCalledWith("/clients/client-1", {
        isActive: false,
      });
      expect(result.isActive).toBe(false);
    });
  });

  describe("delete", () => {
    it("should delete a client", async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await clientsService.delete("client-1");

      expect(api.delete).toHaveBeenCalledWith("/clients/client-1");
    });
  });

  describe("listProjectClients", () => {
    it("should list clients attached to a project", async () => {
      const mockProjectClients = [
        {
          projectId: "proj-1",
          clientId: "client-1",
          client: mockClient,
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      ];
      (api.get as jest.Mock).mockResolvedValue({ data: mockProjectClients });

      const result = await clientsService.listProjectClients("proj-1");

      expect(api.get).toHaveBeenCalledWith("/projects/proj-1/clients");
      expect(result).toEqual(mockProjectClients);
    });
  });

  describe("attachToProject", () => {
    it("should attach a client to a project", async () => {
      const mockProjectClient = {
        projectId: "proj-1",
        clientId: "client-1",
        client: mockClient,
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      (api.post as jest.Mock).mockResolvedValue({ data: mockProjectClient });

      const result = await clientsService.attachToProject("proj-1", "client-1");

      expect(api.post).toHaveBeenCalledWith("/projects/proj-1/clients", {
        clientId: "client-1",
      });
      expect(result).toEqual(mockProjectClient);
    });
  });

  describe("detachFromProject", () => {
    it("should detach a client from a project", async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await clientsService.detachFromProject("proj-1", "client-1");

      expect(api.delete).toHaveBeenCalledWith(
        "/projects/proj-1/clients/client-1",
      );
    });
  });
});
