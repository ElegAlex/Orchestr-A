/**
 * Tests for apps/web/src/lib/logger.ts
 *
 * Security assertions:
 * 1. debug/info/warn are silent in production (NODE_ENV=production)
 * 2. error is always emitted (even in production)
 * 3. PII fields (token, password, email) are scrubbed from log payloads
 */

import { logger } from "@/lib/logger";

describe("logger", () => {
  let spyDebug: jest.SpyInstance;
  let spyInfo: jest.SpyInstance;
  let spyWarn: jest.SpyInstance;
  let spyError: jest.SpyInstance;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    spyDebug = jest.spyOn(console, "debug").mockImplementation(() => {});
    spyInfo = jest.spyOn(console, "info").mockImplementation(() => {});
    spyWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    spyError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    spyDebug.mockRestore();
    spyInfo.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
    // Restore NODE_ENV
    Object.defineProperty(process.env, "NODE_ENV", {
      value: originalEnv,
      configurable: true,
    });
  });

  describe("NODE_ENV guard (production)", () => {
    beforeEach(() => {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: "production",
        configurable: true,
      });
    });

    it("suppresses debug in production", () => {
      logger.debug("should be silent");
      expect(spyDebug).not.toHaveBeenCalled();
    });

    it("suppresses info in production", () => {
      logger.info("should be silent");
      expect(spyInfo).not.toHaveBeenCalled();
    });

    it("suppresses warn in production", () => {
      logger.warn("should be silent");
      expect(spyWarn).not.toHaveBeenCalled();
    });

    it("still emits error in production", () => {
      logger.error("critical error");
      expect(spyError).toHaveBeenCalled();
    });
  });

  describe("NODE_ENV guard (development)", () => {
    beforeEach(() => {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: "development",
        configurable: true,
      });
    });

    it("emits debug in development", () => {
      logger.debug("debug message");
      expect(spyDebug).toHaveBeenCalled();
    });

    it("emits info in development", () => {
      logger.info("info message");
      expect(spyInfo).toHaveBeenCalled();
    });

    it("emits warn in development", () => {
      logger.warn("warn message");
      expect(spyWarn).toHaveBeenCalled();
    });
  });

  describe("PII scrubbing", () => {
    it("redacts token field from object payload", () => {
      const payload = { userId: 1, token: "secret-jwt-value" };
      logger.info("user action", payload);
      const call = spyInfo.mock.calls[0];
      expect(JSON.stringify(call)).not.toContain("secret-jwt-value");
      expect(JSON.stringify(call)).toContain("[REDACTED]");
    });

    it("redacts password field from object payload", () => {
      const payload = { username: "alice", password: "SuperSecret123" };
      logger.info("login attempt", payload);
      const call = spyInfo.mock.calls[0];
      expect(JSON.stringify(call)).not.toContain("SuperSecret123");
      expect(JSON.stringify(call)).toContain("[REDACTED]");
    });

    it("redacts email field from object payload", () => {
      const payload = { email: "alice@example.com", action: "update" };
      logger.info("profile update", payload);
      const call = spyInfo.mock.calls[0];
      expect(JSON.stringify(call)).not.toContain("alice@example.com");
      expect(JSON.stringify(call)).toContain("[REDACTED]");
    });

    it("passes non-PII fields through unchanged", () => {
      const payload = { projectId: 42, status: "active" };
      logger.info("project update", payload);
      const call = spyInfo.mock.calls[0];
      expect(JSON.stringify(call)).toContain("42");
      expect(JSON.stringify(call)).toContain("active");
    });
  });
});
