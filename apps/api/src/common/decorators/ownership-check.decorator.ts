import { SetMetadata } from '@nestjs/common';
import type { OwnedResource } from '../services/ownership.service';

export const OWNERSHIP_METADATA = 'ownership';

export interface OwnershipCheckOptions {
  /** Which resource type the :id param refers to. */
  resource: OwnedResource;
  /** Route param name holding the resource id. Defaults to 'id'. */
  paramKey?: string;
  /**
   * Optional RBAC permission code (e.g. 'projects:manage_any') that, when
   * present on the current user's role, bypasses the ownership check.
   */
  bypassPermission?: string;
}

/**
 * Declarative opt-in ownership enforcement for controller routes.
 *
 * Example:
 *   @UseGuards(JwtAuthGuard, OwnershipGuard)
 *   @OwnershipCheck({ resource: 'leave', bypassPermission: 'leaves:manage_any' })
 *   @Delete(':id')
 *   remove(@Param('id') id: string) { ... }
 */
export const OwnershipCheck = (opts: OwnershipCheckOptions) =>
  SetMetadata(OWNERSHIP_METADATA, { paramKey: 'id', ...opts });
