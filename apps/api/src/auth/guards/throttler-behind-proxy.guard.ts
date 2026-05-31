import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable, ExecutionContext } from '@nestjs/common';
import { clientIp } from '../../common/fastify/trust-proxy.config';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    // SEC-013: the throttle key is the real client IP. Under Fastify+trustProxy
    // that is req.ip (leftmost untrusted hop), NOT req.ips[0] (the nginx socket).
    return Promise.resolve(clientIp(req) ?? 'unknown');
  }

  override getRequestResponse(context: ExecutionContext) {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    return { req: request, res: response };
  }
}
