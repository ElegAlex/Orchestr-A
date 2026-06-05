/**
 * swagger-basic-auth.ts — SEC-010
 *
 * RFC 7617-compliant Basic Auth credential parser for Swagger protection.
 *
 * HTTP Basic Auth encodes credentials as "user:password" where the password
 * itself may contain colons. Only the FIRST colon is a separator; everything
 * after it belongs to the password. Using `.split(':')` without a limit
 * violates RFC 7617 and silently truncates passwords containing colons.
 */

export interface BasicCredentials {
  user: string;
  pass: string;
}

/**
 * Parse a Base64-decoded Basic Auth string into user and password.
 *
 * Splits on the FIRST colon only, so passwords containing colons are
 * preserved in full (RFC 7617 §2).
 *
 * @param decoded - The decoded credential string (e.g. "username:p@ss:word")
 * @returns { user, pass } — both empty strings if the input has no colon
 */
export function parseBasicCredentials(decoded: string): BasicCredentials {
  const sep = decoded.indexOf(':');
  if (sep < 0) {
    return { user: decoded, pass: '' };
  }
  return {
    user: decoded.slice(0, sep),
    pass: decoded.slice(sep + 1),
  };
}
