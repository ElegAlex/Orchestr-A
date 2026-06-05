import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHost(url = '/api/test', method = 'GET') {
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  const reply = { status, send };

  const request = { url, method, id: 'req-001' };

  return {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => request,
    }),
    host: {
      switchToHttp: () => ({
        getResponse: () => reply,
        getRequest: () => request,
      }),
    },
    reply,
    request,
    send,
    status,
  };
}

// ---------------------------------------------------------------------------
// Tests — OBS-017 + OBS-005
// ---------------------------------------------------------------------------

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  // -----------------------------------------------------------------------
  // OBS-005 — captureException must be called on unhandled 500s
  //
  // RED before fix: AllExceptionsFilter constructor accepted no args and
  // always delegated to the no-op SentryClient stub — the spy was never
  // invoked regardless of what was passed.
  // GREEN after fix: the constructor accepts an optional CaptureExceptionFn;
  // when provided it replaces the DSN-derived function so tests can assert
  // call-shape without requiring SENTRY_DSN or the @sentry/node package.
  // -----------------------------------------------------------------------
  describe('OBS-005 — error reporter wiring', () => {
    it('OBS-005 — calls the injected captureException fn with the exception and requestId on non-HttpException', () => {
      const captureException = vi.fn();
      const filterWithSpy = new AllExceptionsFilter(captureException);
      const { host } = buildHost('/api/test');

      const boom = new Error('DB connection lost');
      filterWithSpy.catch(boom, host as unknown as ArgumentsHost);

      // captureException MUST have been called once …
      expect(captureException).toHaveBeenCalledTimes(1);

      // … with the original exception as the first argument …
      expect(captureException).toHaveBeenCalledWith(
        boom,
        expect.objectContaining({ requestId: 'req-001' }),
      );
    });

    it('OBS-005 — captureException is NOT called for HttpException (4xx/5xx from Nest)', () => {
      const captureException = vi.fn();
      const filterWithSpy = new AllExceptionsFilter(captureException);
      const { host } = buildHost('/api/test');

      const httpEx = new HttpException('Not Found', HttpStatus.NOT_FOUND);
      filterWithSpy.catch(httpEx, host as unknown as ArgumentsHost);

      // HttpExceptions are expected; they must not pollute the error reporter.
      expect(captureException).not.toHaveBeenCalled();
    });

    it('OBS-005 — falls back to no-op when no SENTRY_DSN and no injected fn (no crash)', () => {
      // process.env.SENTRY_DSN is not set in the test environment —
      // AllExceptionsFilter() with no args must construct without throwing.
      const filterDefault = new AllExceptionsFilter();
      const { host, send } = buildHost('/api/safe');

      // Must not throw even when there is no reporter configured.
      expect(() =>
        filterDefault.catch(
          new Error('silent'),
          host as unknown as ArgumentsHost,
        ),
      ).not.toThrow();

      // Safe response still sent.
      expect(send).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // RED before fix: a non-HttpException must NOT leak its raw message/stack.
  // GREEN after fix: the response is the safe shape { statusCode, message,
  // timestamp, path } and `message` is always "Internal server error".
  // -----------------------------------------------------------------------
  it('masks unknown (non-HttpException) errors — never leaks raw message or stack', () => {
    const { host, send, status } = buildHost();

    const boom = new Error('boom — secret DB creds in message');
    filter.catch(boom, host as unknown as ArgumentsHost);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = send.mock.calls[0][0] as Record<string, unknown>;

    // Safe shape: these four keys must be present.
    expect(body).toHaveProperty('statusCode', 500);
    expect(body).toHaveProperty('message', 'Internal server error');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('path', '/api/test');

    // NO leak: raw error message must NOT appear in the response.
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain('boom');
    expect(bodyStr).not.toContain('stack');
    expect(bodyStr).not.toContain('DB creds');
  });

  it('handles non-Error thrown values (plain string)', () => {
    const { host, send, status } = buildHost();

    filter.catch('some plain string error', host as unknown as ArgumentsHost);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = send.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toHaveProperty('statusCode', 500);
    expect(body).toHaveProperty('message', 'Internal server error');
    expect(body).not.toHaveProperty('raw');
  });

  it('preserves HttpException status and response body unchanged', () => {
    const { host, send, status } = buildHost();

    const httpEx = new HttpException('Not Found', HttpStatus.NOT_FOUND);
    filter.catch(httpEx, host as unknown as ArgumentsHost);

    expect(status).toHaveBeenCalledWith(404);
    // HttpException with string response is wrapped as { message: string }
    const body = send.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toHaveProperty('message', 'Not Found');
  });

  it('preserves HttpException with object response body', () => {
    const { host, send, status } = buildHost();

    const httpEx = new HttpException(
      { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
      HttpStatus.FORBIDDEN,
    );
    filter.catch(httpEx, host as unknown as ArgumentsHost);

    expect(status).toHaveBeenCalledWith(403);
    const body = send.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toHaveProperty('statusCode', 403);
    expect(body).toHaveProperty('message', 'Forbidden');
  });

  it('includes a timestamp ISO string in safe 500 shape', () => {
    const { host, send } = buildHost();

    filter.catch(new Error('any'), host as unknown as ArgumentsHost);

    const body = send.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof body['timestamp']).toBe('string');
    // must be parseable as ISO date
    expect(new Date(body['timestamp'] as string).toISOString()).toBe(
      body['timestamp'],
    );
  });

  it('includes the request path in safe 500 shape', () => {
    const { host, send } = buildHost('/api/projects/42');

    filter.catch(new Error('any'), host as unknown as ArgumentsHost);

    const body = send.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toHaveProperty('path', '/api/projects/42');
  });
});
