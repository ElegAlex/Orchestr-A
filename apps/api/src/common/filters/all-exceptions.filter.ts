import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * AllExceptionsFilter — OBS-017
 *
 * Catches every exception thrown by the application and normalises the HTTP
 * response to a safe shape: { statusCode, message, timestamp, path }.
 * Stack traces and raw error messages from non-HttpException errors are NEVER
 * forwarded to the client, but are logged server-side with the Fastify
 * requestId for correlation.
 *
 * ACCESS_DENIED audit on 403 is intentionally deferred: wiring AuditService
 * into a global filter would double-emit alongside the services that already
 * audit, flood the immutable hash-chain on high-frequency 403s, and require
 * resolving request.user across all error paths. Structured server-side log is
 * sufficient observability at this layer.
 *
 * Sentry integration is stubbed (no external dependency added). Replace the
 * SentryClient.captureException call below with a real SDK import when the
 * dependency is introduced.
 */

// ---------------------------------------------------------------------------
// Sentry no-op stub — replace with `import * as Sentry from '@sentry/node'`
// when the dependency is added.
// ---------------------------------------------------------------------------
const SentryClient = {
  captureException: (_err: unknown, _ctx?: Record<string, unknown>): void => {
    // no-op until @sentry/node is introduced
  },
};

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // ------------------------------------------------------------------
    // 1. Determine HTTP status and safe message
    // ------------------------------------------------------------------
    let status: number;
    let safeMessage: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      // Mirror Nest's default: forward the HttpException response body.
      // This preserves 400/401/403/404 messages for clients.
      const nestResponse = exception.getResponse();
      const body =
        typeof nestResponse === 'object' && nestResponse !== null
          ? nestResponse
          : { message: nestResponse };
      reply.status(status).send(body);
      return;
    }

    // Non-HttpException → opaque 500, log full detail server-side.
    status = HttpStatus.INTERNAL_SERVER_ERROR;
    safeMessage = 'Internal server error';

    // ------------------------------------------------------------------
    // 2. Server-side structured log (full detail, never forwarded)
    // ------------------------------------------------------------------
    const requestId = (request as FastifyRequest & { id?: string }).id ?? 'n/a';
    const errorDetail =
      exception instanceof Error
        ? { message: exception.message, stack: exception.stack }
        : { raw: String(exception) };

    this.logger.error(
      `[requestId=${requestId}] Unhandled exception on ${request.method} ${request.url}`,
      JSON.stringify(errorDetail),
    );

    // ------------------------------------------------------------------
    // 3. Sentry (stub — no dep)
    // ------------------------------------------------------------------
    SentryClient.captureException(exception, { requestId });

    // ------------------------------------------------------------------
    // 4. Safe response — no stack, no raw message leak
    // ------------------------------------------------------------------
    reply.status(status).send({
      statusCode: status,
      message: safeMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
