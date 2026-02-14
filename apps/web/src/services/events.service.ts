import { api } from "@/lib/api";

export interface Event {
  id: string;
  title: string;
  description?: string;
  date: Date | string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  projectId?: string;
  createdById: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  project?: {
    id: string;
    name: string;
    status?: string;
  };
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatarUrl?: string;
    role?: string;
  };
  participants?: Array<{
    eventId: string;
    userId: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      avatarUrl?: string;
      role?: string;
    };
  }>;
}

export interface CreateEventDto {
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  projectId?: string;
  participantIds?: string[];
}

export interface UpdateEventDto {
  title?: string;
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  projectId?: string;
  participantIds?: string[];
}

export const eventsService = {
  async getAll(
    startDate?: string,
    endDate?: string,
    userId?: string,
    projectId?: string,
  ): Promise<Event[]> {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (userId) params.append("userId", userId);
    if (projectId) params.append("projectId", projectId);

    const response = await api.get<Event[]>(`/events?${params.toString()}`);
    return response.data;
  },

  async getById(id: string): Promise<Event> {
    const response = await api.get<Event>(`/events/${id}`);
    return response.data;
  },

  async getByUser(userId: string): Promise<Event[]> {
    const response = await api.get<Event[]>(`/events/user/${userId}`);
    return response.data;
  },

  async getByRange(start: string, end: string): Promise<Event[]> {
    const response = await api.get<Event[]>(
      `/events/range?start=${start}&end=${end}`,
    );
    return response.data;
  },

  async create(data: CreateEventDto): Promise<Event> {
    const response = await api.post<Event>("/events", data);
    return response.data;
  },

  async update(id: string, data: UpdateEventDto): Promise<Event> {
    const response = await api.patch<Event>(`/events/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/events/${id}`);
  },

  async addParticipant(eventId: string, userId: string): Promise<void> {
    await api.post(`/events/${eventId}/participants`, { userId });
  },

  async removeParticipant(eventId: string, userId: string): Promise<void> {
    await api.delete(`/events/${eventId}/participants/${userId}`);
  },
};
