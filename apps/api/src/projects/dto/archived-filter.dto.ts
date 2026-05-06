import { Prisma } from 'database';
import { IsEnum, IsOptional } from 'class-validator';

export enum ArchivedFilter {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  ALL = 'all',
}

export class ArchivedFilterDto {
  @IsOptional()
  @IsEnum(ArchivedFilter)
  archived?: ArchivedFilter;
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
