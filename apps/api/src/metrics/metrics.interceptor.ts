import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { MetricsService } from './metrics.service';

/**
 * OBS-011 — Records HTTP request duration and status for every request.
 *
 * Applied globally via MetricsModule (APP_INTERCEPTOR).
 * Defensive: if MetricsService throws, the error is swallowed and the
 * original response/error is propagated unchanged.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<{
      method: string;
      path: string;
    }>();
    const start = Date.now();
    const method = req.method ?? 'UNKNOWN';
    const route = req.path ?? '/';

    return next.handle().pipe(
      tap(() => {
        const res = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>();
        const status = res.statusCode ?? 200;
        const durationMs = Date.now() - start;
        try {
          this.metricsService.recordRequest(method, route, status, durationMs);
        } catch {
          // swallow — metrics must never break the response pipeline
        }
      }),
      catchError((err: unknown) => {
        const res = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>();
        const status = res.statusCode ?? 500;
        const durationMs = Date.now() - start;
        try {
          this.metricsService.recordRequest(method, route, status, durationMs);
        } catch {
          // swallow
        }
        return throwError(() => err);
      }),
    );
  }
}
