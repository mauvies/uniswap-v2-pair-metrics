import type { PairMetrics } from "@uniswap-v2-pair-metrics/shared";
import { findPair } from "@uniswap-v2-pair-metrics/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { type Db, storedExtent, storedSeries } from "./db/index.ts";
import { buildPoints, floorToHour, lookbackStart, rangeOf, resolveHours } from "./series.ts";

const params = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "expected a 40-character hex address"),
});

/** A date alone is midnight UTC, which is what a date picker sends (§2.5). */
const instant = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

const query = z.object({
  from: instant.optional(),
  to: instant.optional(),
});

/**
 * Fastify's default handler reads `statusCode` off the error and serialises
 * `{ statusCode, error, message }` — the shape its own router already returns for an
 * unknown route. It also logs anything at 500 or above, which is why nothing here logs
 * explicitly; `/health` has to, because it returns its 503 as a body rather than throwing.
 */
function httpError(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode });
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw httpError(400, z.prettifyError(parsed.error));
  }

  return parsed.data;
}

export function registerMetrics(app: FastifyInstance, db: Db): void {
  app.get("/pairs/:address/metrics", async (request): Promise<PairMetrics> => {
    const { address } = parse(params, request.params);
    const pair = findPair(address);

    if (pair === undefined) {
      throw httpError(404, `${address} is not one of the configured pairs`);
    }

    const { from, to } = parse(query, request.query);
    const fromHour = from === undefined ? undefined : floorToHour(from);
    const toHour = to === undefined ? undefined : floorToHour(to);

    // Only when the client supplied both: a bound that fell back to the stored extent
    // cannot be a client error, and reads as an empty intersection instead (§6.1).
    if (fromHour !== undefined && toHour !== undefined && fromHour > toHour) {
      throw httpError(400, "from is after to");
    }

    const extent = await reachDatabase(storedExtent(db, pair.address));

    if (extent === null) {
      return { pair, range: null, points: [] };
    }

    const resolved = resolveHours(extent, fromHour, toHour);

    if (resolved === null) {
      return { pair, range: null, points: [] };
    }

    const rows = await reachDatabase(
      storedSeries(db, pair.address, lookbackStart(resolved.fromHour), resolved.toHour),
    );
    const points = buildPoints(rows, resolved.fromHour);

    return { pair, range: rangeOf(points), points };
  });
}

/**
 * 503 rather than the 500 an unhandled rejection would produce, for the same reason
 * `/health` answers 503: the service is up and the dependency is not (§6.1).
 *
 * The message reports the read that failed, not why. Both statements are fixed and take the
 * range only as parameters, so what is reachable here is the pool's connect timeout, a
 * refused connection or a terminated one — all of them availability. Reading SQLSTATE to
 * separate those from a malformed statement would be a second classifier (§5.4) guarding a
 * condition this path cannot reach, and `cause` already carries the original.
 */
async function reachDatabase<T>(query: Promise<T>): Promise<T> {
  try {
    return await query;
  } catch (cause) {
    throw Object.assign(httpError(503, "the database read failed"), { cause });
  }
}
