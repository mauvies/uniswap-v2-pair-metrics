import type { ZodError, ZodType } from "zod";
import { PAGE_SIZE, REQUEST_TIMEOUT_MS, RETRY_ATTEMPTS } from "../constants.ts";
import { assertFetchWindow } from "../hours.ts";
import {
  backoffMs,
  classifyStatus,
  GatewayError,
  type GatewayFailure,
  isRetryable,
} from "./failures.ts";
import { envelope, type Meta, metaResponse, type PairHour, pairHoursResponse } from "./schemas.ts";

const META_QUERY = `{ _meta { block { timestamp } hasIndexingErrors } }`;

// Explicit `first` and ascending order, so passing the page limit returns a contiguous
// prefix the next run resumes from, not an arbitrary slice (§9).
const PAIR_HOURS_QUERY = `
  query PairHours($pair: String!, $from: Int!, $to: Int!, $first: Int!) {
    pairHourDatas(
      first: $first
      orderBy: hourStartUnix
      orderDirection: asc
      where: { pair: $pair, hourStartUnix_gte: $from, hourStartUnix_lt: $to }
    ) {
      hourStartUnix
      reserve0
      reserve1
      reserveUSD
      hourlyVolumeToken0
      hourlyVolumeToken1
      hourlyVolumeUSD
      hourlyTxns
    }
  }
`;

type Attempt<T> = { ok: true; value: T } | { ok: false; failure: GatewayFailure };

function invalidShape(error: ZodError): GatewayFailure {
  return {
    kind: "invalid-shape",
    issues: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}

export interface GatewayOptions {
  url: string;
  fetch?: typeof globalThis.fetch;
  /** Lowered in tests so the truncation path runs against the real query builder. */
  pageSize?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface Gateway {
  meta(): Promise<Meta>;
  pairHours(pair: string, from: number, to: number): Promise<PairHour[]>;
}

export function createGateway(options: GatewayOptions): Gateway {
  const doFetch = options.fetch ?? globalThis.fetch;
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  async function attempt<T>(schema: ZodType<T>, body: object): Promise<Attempt<T>> {
    let response: Response;

    try {
      response = await doFetch(options.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      return { ok: false, failure: { kind: "transport", cause } };
    }

    const statusFailure = classifyStatus(response.status);

    if (statusFailure !== undefined) {
      return { ok: false, failure: statusFailure };
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch (cause) {
      return { ok: false, failure: { kind: "malformed-body", cause } };
    }

    const wrapper = envelope.safeParse(payload);

    if (!wrapper.success) {
      return { ok: false, failure: invalidShape(wrapper.error) };
    }

    // A 200 can still carry errors (§1).
    const { data, errors } = wrapper.data;

    if (errors !== undefined && errors.length > 0) {
      return {
        ok: false,
        failure: { kind: "graphql-errors", messages: errors.map((e) => e.message) },
      };
    }

    const parsed = schema.safeParse(data);

    if (!parsed.success) {
      return { ok: false, failure: invalidShape(parsed.error) };
    }

    return { ok: true, value: parsed.data };
  }

  async function query<T>(schema: ZodType<T>, body: object): Promise<T> {
    let attemptNumber = 1;

    while (true) {
      const result = await attempt(schema, body);

      if (result.ok) {
        return result.value;
      }

      const areRetriesLeft = attemptNumber < RETRY_ATTEMPTS;
      const delay =
        areRetriesLeft && isRetryable(result.failure) ? backoffMs(attemptNumber) : undefined;

      if (delay === undefined) {
        throw new GatewayError(result.failure);
      }

      await sleep(delay);
      attemptNumber += 1;
    }
  }

  return {
    async meta() {
      const { _meta } = await query(metaResponse, { query: META_QUERY });

      return _meta;
    },

    async pairHours(pair, from, to) {
      const { pairHourDatas } = await query(pairHoursResponse, {
        query: PAIR_HOURS_QUERY,
        variables: { pair, from, to, first: pageSize },
      });

      const hoursArray = pairHourDatas.map((row) => row.hourStartUnix);
      assertFetchWindow(hoursArray, from, to);

      return pairHourDatas;
    },
  };
}
