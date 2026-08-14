import { HOUR_SECONDS, PAIRS } from "@uniswap-v2-pair-metrics/shared";
import type { FastifyInstance } from "fastify";
import { type Db, latestStoredHours } from "./db/index.ts";

export interface PairHealth {
  address: string;
  lastHourStartUnix: number | null;
  ageSeconds: number | null;
}

export interface Health {
  ok: boolean;
  db: boolean;
  pairs: PairHealth[];
}

export function registerHealth(app: FastifyInstance, db: Db): void {
  app.get("/health", async (request, reply): Promise<Health> => {
    let latest: Map<string, number>;

    try {
      latest = await latestStoredHours(db);
    } catch (error) {
      request.log.error({ err: error }, "health check could not reach the database");
      reply.code(503);

      return { ok: false, db: false, pairs: [] };
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);

    // `ok` is the verdict a monitor reads and `db` the dependency that decided it. The
    // database is the only one, so today they cannot disagree.
    return {
      ok: true,
      db: true,
      pairs: PAIRS.map((pair) => pairHealth(pair.address, latest.get(pair.address), nowInSeconds)),
    };
  });
}

/**
 * Age runs from the *end* of the last stored hour, the reference ingest's staleness guard
 * uses (§5.1) — so this is the number that decides whether a run is due, not a second one
 * that resembles it.
 *
 * Both fields are null for a pair with no rows: the table cannot say why it is empty, and
 * an age counted from nothing would read as a multi-year outage (§6.1).
 */
function pairHealth(
  address: string,
  lastHourStartUnix: number | undefined,
  nowInSeconds: number,
): PairHealth {
  if (lastHourStartUnix === undefined) {
    return { address, lastHourStartUnix: null, ageSeconds: null };
  }

  return {
    address,
    lastHourStartUnix,
    ageSeconds: nowInSeconds - (lastHourStartUnix + HOUR_SECONDS),
  };
}
