import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

interface AuthenticatedRequest {
  user: User;
}

export const CurrentUser = createParamDecorator(
  (
    data: keyof User | undefined,
    ctx: ExecutionContext,
  ): User | User[keyof User] | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
