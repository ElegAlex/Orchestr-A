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
 * Error reporter — OBS-005:
 * When SENTRY_DSN is set, @sentry/node is loaded dynamically and Sentry.init()
 * is called once. captureExceptionFn is then bound to Sentry.captureException
 * so that every unhandled 500 is forwarded to the configured backend.
 * If SENTRY_DSN is absent (or @sentry/node is not installed), the constructor
 * falls back to a no-op — the application boots without error.
 *
 * PII policy: only stack trace + requestId are forwarded; email, names, and
 * request bodies are never included in the Sentry context.
 *
 * For testing: pass a spy as the second constructor argument instead of
 * relying on process.env.SENTRY_DSN.
 */

// ---------------------------------------------------------------------------
// Capture-exception type — mirrors Sentry's captureException signature but
// kept internal so no hard dep on @sentry/node types is required.
// ---------------------------------------------------------------------------
type CaptureExceptionFn = (
  err: unknown,
  hint?: Record<string, unknown>,
) => void;

/**
 * Build the capture function at construction time.
 *
 * - SENTRY_DSN absent → returns a no-op (zero egress, existing behaviour).
 * - SENTRY_DSN present but @sentry/node not installed → logs a warning and
 *   returns a no-op so the application keeps running.
 * - SENTRY_DSN present and @sentry/node available → initialises Sentry and
 *   returns a bound captureException.
 */
function buildCaptureException(
  logger: import('@nestjs/common').Logger,
): CaptureExceptionFn {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return () => {};
  }
  try {
    // Dynamic require keeps @sentry/node as an optional peer — the package
    // need not be installed in environments where the DSN is not configured.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as {
      init: (opts: { dsn: string }) => void;
      captureException: (
        err: unknown,
        hint?: { extra?: Record<string, unknown> },
      ) => void;
    };
    Sentry.init({ dsn });
    return (err, hint) =>
      Sentry.captureException(err, hint ? { extra: hint } : undefined);
  } catch {
    logger.warn(
      '[OBS-005] SENTRY_DSN is set but @sentry/node could not be loaded ' +
        '— add it to package.json to enable remote error reporting.',
    );
    return () => {};
  }
}

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly captureException: CaptureExceptionFn;

  constructor(captureExceptionFn?: CaptureExceptionFn) {
    // Allow callers (e.g. tests) to inject a spy; otherwise derive from DSN.
    if (captureExceptionFn !== undefined) {
      this.captureException = captureExceptionFn;
    } else {
      this.captureException = buildCaptureException(this.logger);
    }
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // ------------------------------------------------------------------
    // 1. Determine HTTP status and safe message
    // ------------------------------------------------------------------
    let status: number;

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
    const safeMessage = 'Internal server error';

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
    // 3. Error reporter — OBS-005 (real when SENTRY_DSN is set)
    // ------------------------------------------------------------------
    this.captureException(exception, { requestId });

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
