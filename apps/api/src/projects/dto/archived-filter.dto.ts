import { Prisma } from 'database';

export enum ArchivedFilter {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  ALL = 'all',
}

export function archivedWhere(
  filter: ArchivedFilter = ArchivedFilter.ACTIVE,
): Prisma.ProjectWhereInput {
  switch (filter) {
    case ArchivedFilter.ARCHIVED:
      return { archivedAt: { not: null } };
    case ArchivedFilter.ALL:
      return {};
    case ArchivedFilter.ACTIVE:
    default:
      return { archivedAt: null };
  }
}
