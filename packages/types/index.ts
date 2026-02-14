// ===========================
// ENUMS
// ===========================

export enum Role {
  ADMIN = 'ADMIN',
  RESPONSABLE = 'RESPONSABLE',
  MANAGER = 'MANAGER',
  CHEF_DE_PROJET = 'CHEF_DE_PROJET',
  REFERENT_TECHNIQUE = 'REFERENT_TECHNIQUE',
  CONTRIBUTEUR = 'CONTRIBUTEUR',
  OBSERVATEUR = 'OBSERVATEUR',
}

// ===========================
// EVENTS
// ===========================

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  date: Date | string;
  startTime?: string | null;
  endTime?: string | null;
  isAllDay: boolean;
  projectId?: string | null;
  createdById: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface EventParticipant {
  eventId: string;
  userId: string;
}

export interface EventWithParticipants extends Event {
  participants: EventParticipant[];
}

export interface CreateEventDto {
  title: string;
  description?: string;
  date: Date | string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  projectId?: string;
  participantIds?: string[];
}

export interface UpdateEventDto {
  title?: string;
  description?: string;
  date?: Date | string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  projectId?: string;
  participantIds?: string[];
}
