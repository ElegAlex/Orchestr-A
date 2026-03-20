import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    // Fastify: use x-forwarded-for if behind proxy, otherwise use IP
    return Promise.resolve(
      req.ips?.length ? req.ips[0] : req.ip ?? 'unknown',
    );
  }

  override getRequestResponse(context: ExecutionContext) {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    return { req: request, res: response };
  }
}
