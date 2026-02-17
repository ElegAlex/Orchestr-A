import {
  eventsService,
  CreateEventDto,
  UpdateEventDto,
} from "./events.service";
import { api } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("eventsService", () => {
  const mockEvent = {
    id: "1",
    title: "Réunion de suivi",
    description: "Revue du projet",
    date: "2025-11-10",
    startTime: "14:00",
    endTime: "15:00",
    isAllDay: false,
    projectId: "project-1",
    createdById: "user-1",
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    project: { id: "project-1", name: "Projet Test" },
    createdBy: {
      id: "user-1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    },
    participants: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAll", () => {
    it("should fetch all events", async () => {
      const events = [mockEvent];
      (api.get as jest.Mock).mockResolvedValue({ data: events });

      const result = await eventsService.getAll();

      expect(result).toEqual(events);
      expect(api.get).toHaveBeenCalledWith("/events?");
    });

    it("should fetch events with filters", async () => {
      const events = [mockEvent];
      (api.get as jest.Mock).mockResolvedValue({ data: events });

      const result = await eventsService.getAll(
        "2025-11-01",
        "2025-11-30",
        "user-1",
        "project-1",
      );

      expect(result).toEqual(events);
      expect(api.get).toHaveBeenCalledWith(
        "/events?startDate=2025-11-01&endDate=2025-11-30&userId=user-1&projectId=project-1",
      );
    });
  });

  describe("getById", () => {
    it("should fetch an event by id", async () => {
      (api.get as jest.Mock).mockResolvedValue({
        data: mockEvent,
      });

      const result = await eventsService.getById("1");

      expect(result).toEqual(mockEvent);
      expect(api.get).toHaveBeenCalledWith("/events/1");
    });
  });

  describe("getByUser", () => {
    it("should fetch events by user", async () => {
      const events = [mockEvent];
      (api.get as jest.Mock).mockResolvedValue({ data: events });

      const result = await eventsService.getByUser("user-1");

      expect(result).toEqual(events);
      expect(api.get).toHaveBeenCalledWith("/events/user/user-1");
    });
  });

  describe("getByRange", () => {
    it("should fetch events by date range", async () => {
      const events = [mockEvent];
      (api.get as jest.Mock).mockResolvedValue({ data: events });

      const result = await eventsService.getByRange("2025-11-01", "2025-11-30");

      expect(result).toEqual(events);
      expect(api.get).toHaveBeenCalledWith(
        "/events/range?start=2025-11-01&end=2025-11-30",
      );
    });
  });

  describe("create", () => {
    it("should create an event", async () => {
      const createEventDto: CreateEventDto = {
        title: "Réunion de suivi",
        description: "Revue du projet",
        date: "2025-11-10",
        startTime: "14:00",
        endTime: "15:00",
        isAllDay: false,
        projectId: "project-1",
        participantIds: ["user-2"],
      };
      (api.post as jest.Mock).mockResolvedValue({
        data: mockEvent,
      });

      const result = await eventsService.create(createEventDto);

      expect(result).toEqual(mockEvent);
      expect(api.post).toHaveBeenCalledWith("/events", createEventDto);
    });
  });

  describe("update", () => {
    it("should update an event", async () => {
      const updateEventDto: UpdateEventDto = {
        title: "Réunion mise à jour",
      };
      const updatedEvent = { ...mockEvent, ...updateEventDto };
      (api.patch as jest.Mock).mockResolvedValue({
        data: updatedEvent,
      });

      const result = await eventsService.update("1", updateEventDto);

      expect(result).toEqual(updatedEvent);
      expect(api.patch).toHaveBeenCalledWith("/events/1", updateEventDto);
    });
  });

  describe("delete", () => {
    it("should delete an event", async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await eventsService.delete("1");

      expect(api.delete).toHaveBeenCalledWith("/events/1");
    });
  });

  describe("addParticipant", () => {
    it("should add a participant to an event", async () => {
      (api.post as jest.Mock).mockResolvedValue({});

      await eventsService.addParticipant("event-1", "user-2");

      expect(api.post).toHaveBeenCalledWith("/events/event-1/participants", {
        userId: "user-2",
      });
    });
  });

  describe("removeParticipant", () => {
    it("should remove a participant from an event", async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await eventsService.removeParticipant("event-1", "user-2");

      expect(api.delete).toHaveBeenCalledWith(
        "/events/event-1/participants/user-2",
      );
    });
  });
});
