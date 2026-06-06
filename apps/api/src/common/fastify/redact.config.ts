export const fastifyLoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      // Request headers
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.headers["proxy-authorization"]',

      // Request body — auth / token fields
      'req.body.login',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.refreshToken',
      'req.body.token',

      // Request query — reset-password / invite links
      'req.query.token',

      // Request body — sensitive PII (leave/medical reasons)
      'req.body.validationComment',
      'req.body.reason',
      'req.body.motif',
      'req.body.justification',

      // Response headers
      'res.headers["set-cookie"]',

      // Response body — credentials that may be serialised
      'res.body.passwordHash',
      'res.body.refresh_token',
      'res.body.access_token',
    ],
    censor: '[REDACTED]',
  },
};
