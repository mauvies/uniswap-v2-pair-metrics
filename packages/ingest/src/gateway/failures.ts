import { RETRY_BACKOFF_MS } from "../constants.ts";

/**
 * By cause rather than by status: this gateway answers HTTP 200 with an `errors` array for
 * every failure, auth included (§1), so reading the status alone would classify an expired
 * key as success.
 */
export type GatewayFailure =
  | { kind: "transport"; cause: unknown }
  | { kind: "rate-limited"; status: number }
  | { kind: "server-error"; status: number }
  | { kind: "http-error"; status: number }
  | { kind: "malformed-body"; cause: unknown }
  | { kind: "graphql-errors"; messages: readonly string[] }
  | { kind: "invalid-shape"; issues: readonly string[] };

export class GatewayError extends Error {
  readonly failure: GatewayFailure;

  constructor(failure: GatewayFailure) {
    super(describe(failure));
    this.name = "GatewayError";
    this.failure = failure;
  }
}

/**
 * Retry only what a second attempt could answer differently. Exhaustive with no `default`,
 * so adding a variant without deciding its verdict fails to compile.
 */
export function isRetryable(failure: GatewayFailure): boolean {
  switch (failure.kind) {
    case "transport":
    case "rate-limited":
    case "server-error":
      return true;
    // Our request, our key, or a contract change. A second identical attempt spends quota
    // to be told the same thing.
    case "http-error":
    case "malformed-body":
    case "graphql-errors":
    case "invalid-shape":
      return false;
  }
}

export function classifyStatus(status: number): GatewayFailure | undefined {
  if (status >= 200 && status < 300) {
    return undefined;
  }
  if (status === 429) {
    return { kind: "rate-limited", status };
  }
  if (status >= 500) {
    return { kind: "server-error", status };
  }

  return { kind: "http-error", status };
}

export function backoffMs(attempt: number): number | undefined {
  return RETRY_BACKOFF_MS[attempt - 1];
}

function describe(failure: GatewayFailure): string {
  switch (failure.kind) {
    case "transport":
      return `gateway transport failure: ${String(failure.cause)}`;
    case "rate-limited":
    case "server-error":
    case "http-error":
      return `gateway returned HTTP ${failure.status}`;
    case "malformed-body":
      return `gateway response was not JSON: ${String(failure.cause)}`;
    case "graphql-errors":
      return `gateway returned errors: ${failure.messages.join("; ")}`;
    case "invalid-shape":
      return `gateway response did not match the expected shape: ${failure.issues.join("; ")}`;
  }
}
