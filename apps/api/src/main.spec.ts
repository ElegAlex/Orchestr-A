/**
 * main.spec.ts — OBS-010
 *
 * Tests for the DSN-optional no-op error reporter scaffold.
 *
 * Verifies:
 *  1. ErrorReporter interface is importable (module exists)
 *  2. installGlobalErrorHandlers invokes reporter.report on unhandledRejection
 *  3. installGlobalErrorHandlers invokes reporter.report on uncaughtException
 *  4. NoopErrorReporter never triggers external egress (no fetch, no http)
 */

import { EventEmitter } from 'events';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NoopErrorReporter,
  installGlobalErrorHandlers,
  type ErrorReporter,
} from './common/error-reporter';

describe('ErrorReporter scaffold (OBS-010)', () => {
  let emitter: EventEmitter;
  let mockReporter: ErrorReporter;

  beforeEach(() => {
    emitter = new EventEmitter();
    // Prevent MaxListeners warnings in test runs
    emitter.setMaxListeners(20);
    mockReporter = { report: vi.fn() };
  });

  afterEach(() => {
    emitter.removeAllListeners();
  });

  it('NoopErrorReporter.report() exists and does not throw', () => {
    const reporter = new NoopErrorReporter();
    expect(() => reporter.report(new Error('test'))).not.toThrow();
  });

  it('NoopErrorReporter.report() does not trigger fetch or http egress', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => Promise.resolve(new Response()),
    );
    const reporter = new NoopErrorReporter();
    reporter.report(new Error('no egress'));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('installGlobalErrorHandlers() calls reporter.report on unhandledRejection', async () => {
    installGlobalErrorHandlers(mockReporter, emitter);
    const reason = new Error('unhandled rejection');
    emitter.emit('unhandledRejection', reason, Promise.resolve());
    expect(mockReporter.report).toHaveBeenCalledWith(reason, {
      event: 'unhandledRejection',
    });
  });

  it('installGlobalErrorHandlers() calls reporter.report on uncaughtException', () => {
    installGlobalErrorHandlers(mockReporter, emitter);
    const err = new Error('uncaught exception');
    emitter.emit('uncaughtException', err);
    expect(mockReporter.report).toHaveBeenCalledWith(err, {
      event: 'uncaughtException',
    });
  });

  it('installGlobalErrorHandlers() is idempotent (double-install does not double-fire)', () => {
    installGlobalErrorHandlers(mockReporter, emitter);
    installGlobalErrorHandlers(mockReporter, emitter);
    emitter.emit('unhandledRejection', new Error('once'), Promise.resolve());
    expect(mockReporter.report).toHaveBeenCalledTimes(1);
  });
});
