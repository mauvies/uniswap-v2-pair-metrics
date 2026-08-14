import { describe, expect, it } from "vitest";
import { RETRY_ATTEMPTS } from "../constants.ts";
import {
  backoffMs,
  classifyStatus,
  GatewayError,
  type GatewayFailure,
  isRetryable,
} from "./failures.ts";

const RETRYABLE: GatewayFailure[] = [
  { kind: "transport", cause: new Error("ECONNRESET") },
  { kind: "rate-limited", status: 429 },
  { kind: "server-error", status: 503 },
];

const FATAL: GatewayFailure[] = [
  { kind: "http-error", status: 404 },
  { kind: "malformed-body", cause: new SyntaxError("Unexpected token <") },
  { kind: "graphql-errors", messages: ["auth error: malformed API key"] },
  { kind: "invalid-shape", issues: ["reserveUSD: expected a finite non-negative decimal"] },
];

describe("classifier cases", () => {
  it.each(RETRYABLE)("retries $kind", (failure) => {
    expect(isRetryable(failure)).toBe(true);
  });

  it.each(FATAL)("fails fast on $kind", (failure) => {
    expect(isRetryable(failure)).toBe(false);
  });

  it("classifies by status, treating every 2xx as success", () => {
    expect(classifyStatus(200)).toBeUndefined();
    expect(classifyStatus(204)).toBeUndefined();
    expect(classifyStatus(429)?.kind).toBe("rate-limited");
    expect(classifyStatus(500)?.kind).toBe("server-error");
    expect(classifyStatus(502)?.kind).toBe("server-error");
    expect(classifyStatus(400)?.kind).toBe("http-error");
    expect(classifyStatus(401)?.kind).toBe("http-error");
  });

  it("runs out of backoff after the last attempt", () => {
    expect(backoffMs(1)).toBe(250);
    expect(backoffMs(2)).toBe(500);
    expect(backoffMs(RETRY_ATTEMPTS)).toBeUndefined();
  });

  it("never puts the request URL, and so the API key, in the message", () => {
    for (const failure of [...RETRYABLE, ...FATAL]) {
      expect(new GatewayError(failure).message).not.toMatch(/gateway\.thegraph\.com|api\//);
    }
  });
});
