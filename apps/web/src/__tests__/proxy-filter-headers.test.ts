/**
 * @jest-environment node
 *
 * SEC-031 — API proxy must NOT forward host-spoofing headers to the internal backend.
 *
 * RED pre-fix: filterHeaders passes `host`, `x-forwarded-host`, `x-real-ip` through.
 * GREEN post-fix: all three are stripped; safe headers (authorization, content-type)
 *                 still pass through.
 */

// Mock @/lib/logger so route.ts can be imported without side-effects.
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { filterHeaders } from "../../app/api/[...path]/route";

function makeHeaders(entries: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(entries)) h.set(k, v);
  return h;
}

describe("filterHeaders (SEC-031 — host-header injection guard)", () => {
  it("strips the `host` header", () => {
    const result = filterHeaders(
      makeHeaders({ host: "attacker.com", authorization: "Bearer tok" }),
    );
    expect(result).not.toHaveProperty("host");
  });

  it("strips `x-forwarded-host`", () => {
    const result = filterHeaders(
      makeHeaders({ "x-forwarded-host": "evil.co" }),
    );
    expect(result).not.toHaveProperty("x-forwarded-host");
  });

  it("strips `x-real-ip`", () => {
    const result = filterHeaders(makeHeaders({ "x-real-ip": "1.2.3.4" }));
    expect(result).not.toHaveProperty("x-real-ip");
  });

  it("still forwards safe headers (authorization, content-type)", () => {
    const result = filterHeaders(
      makeHeaders({
        authorization: "Bearer tok",
        "content-type": "application/json",
        host: "attacker.com",
      }),
    );
    expect(result["authorization"]).toBe("Bearer tok");
    expect(result["content-type"]).toBe("application/json");
  });

  it("strips standard hop-by-hop headers (connection, transfer-encoding)", () => {
    const result = filterHeaders(
      makeHeaders({ connection: "keep-alive", "transfer-encoding": "chunked" }),
    );
    expect(result).not.toHaveProperty("connection");
    expect(result).not.toHaveProperty("transfer-encoding");
  });
});
