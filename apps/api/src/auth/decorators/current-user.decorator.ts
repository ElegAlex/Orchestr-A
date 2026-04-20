import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '@prisma/client';

/**
 * Forme de `request.user` injectée par `JwtStrategy.validate`. Inclut la
 * relation `role` (objet Role Prisma, ou null si user sans rôle assigné).
 * Ne contient PAS `passwordHash` (exclu côté select).
 */
export type AuthenticatedUser = Omit<User, 'passwordHash'> & {
  role: {
    id: string;
    code: string;
    label: string;
    templateKey: string;
    isSystem: boolean;
  } | null;
  jti?: string;
  exp?: number;
};

interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
