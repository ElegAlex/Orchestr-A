import { fastifyLoggerOptions } from './redact.config';

describe('fastifyLoggerOptions redact paths', () => {
  const { paths } = fastifyLoggerOptions.redact;

  // --- paths that were already there (regression guard) ---
  it('redacts authorization header', () => {
    expect(paths).toContain('req.headers.authorization');
  });

  it('redacts cookie header', () => {
    expect(paths).toContain('req.headers.cookie');
  });

  it('redacts body.password', () => {
    expect(paths).toContain('req.body.password');
  });

  it('redacts body.refreshToken', () => {
    expect(paths).toContain('req.body.refreshToken');
  });

  it('redacts set-cookie response header', () => {
    expect(paths).toContain('res.headers["set-cookie"]');
  });

  // --- NEW paths required by OBS-014 ---

  it('redacts x-api-key header', () => {
    expect(paths).toContain('req.headers["x-api-key"]');
  });

  it('redacts query token (password-reset / invite links)', () => {
    expect(paths).toContain('req.query.token');
  });

  it('redacts body.token (password-reset body)', () => {
    expect(paths).toContain('req.body.token');
  });

  it('redacts body.validationComment (sensitive PII)', () => {
    expect(paths).toContain('req.body.validationComment');
  });

  it('redacts body.reason (sensitive PII)', () => {
    expect(paths).toContain('req.body.reason');
  });

  it('redacts body.motif (sensitive PII)', () => {
    expect(paths).toContain('req.body.motif');
  });

  it('redacts body.justification (sensitive PII)', () => {
    expect(paths).toContain('req.body.justification');
  });

  it('redacts response body passwordHash', () => {
    expect(paths).toContain('res.body.passwordHash');
  });

  it('redacts response body refresh_token', () => {
    expect(paths).toContain('res.body.refresh_token');
  });

  it('redacts response body access_token', () => {
    expect(paths).toContain('res.body.access_token');
  });

  it('redacts proxy-authorization header', () => {
    expect(paths).toContain('req.headers["proxy-authorization"]');
  });

  // OBS-023 — user login identifier (prenom.nom PII) must be redacted
  it('redacts body.login (user identifier — OBS-023)', () => {
    expect(paths).toContain('req.body.login');
  });
});
