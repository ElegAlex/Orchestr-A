/**
 * error-reporter.ts — OBS-010
 *
 * DSN-optional, no-egress error reporter scaffold.
 *
 * Design rationale:
 * - The Sentry vs GlitchTip (RGPD sovereignty) choice is an OPERATOR decision;
 *   no provider SDK is imported here. The interface is the extension point.
 * - NoopErrorReporter is the default: it captures unhandled rejections and
 *   uncaught exceptions on the process (or injectable EventEmitter) and logs
 *   them server-side without any external network call.
 * - installGlobalErrorHandlers is idempotent: a second call on the same emitter
 *   is a no-op (guards via a WeakSet flag on the emitter instance).
 * - Replace NoopErrorReporter with a real implementation (Sentry, GlitchTip,
 *   OpenTelemetry …) when the operator DSN is configured; the interface and
 *   install wiring remain unchanged.
 */

import { Logger } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Public interface — the only coupling point for callers
// ---------------------------------------------------------------------------

export interface ErrorReporter {
  /**
   * Report an error to the configured backend.
   * Must never throw. Must not perform external I/O in the default no-op impl.
   */
  report(err: unknown, context?: Record<string, unknown>): void;
}

// ---------------------------------------------------------------------------
// No-op implementation (default — zero egress, zero deps)
// ---------------------------------------------------------------------------

export class NoopErrorReporter implements ErrorReporter {
  private readonly logger = new Logger('ErrorReporter');

  report(err: unknown, context?: Record<string, unknown>): void {
    // Server-side log only — no external call, no PII egress.
    const detail =
      err instanceof Error
        ? { message: err.message, stack: err.stack }
        : { raw: String(err) };

    this.logger.error(
      '[OBS-010] Unhandled error captured (no-op reporter — configure a DSN to enable remote tracking)',
      JSON.stringify({ ...detail, ...(context ?? {}) }),
    );
  }
}

// ---------------------------------------------------------------------------
// Process-level wiring
// ---------------------------------------------------------------------------

// WeakSet prevents double-registration when bootstrap() is called more than once
// (e.g. test environments that create multiple apps).
const installedEmitters = new WeakSet<NodeJS.EventEmitter>();

/**
 * Wire global error handlers for unhandledRejection and uncaughtException onto
 * `emitter` (defaults to `process`). Idempotent.
 */
export function installGlobalErrorHandlers(
  reporter: ErrorReporter,
  emitter: NodeJS.EventEmitter = process,
): void {
  if (installedEmitters.has(emitter)) {
    return;
  }
  installedEmitters.add(emitter);

  emitter.on('unhandledRejection', (reason: unknown) => {
    reporter.report(reason, { event: 'unhandledRejection' });
  });

  emitter.on('uncaughtException', (err: Error) => {
    reporter.report(err, { event: 'uncaughtException' });
  });
}
