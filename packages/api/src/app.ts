import Fastify, { type FastifyInstance } from "fastify";
import type { Db } from "./db/index.ts";
import { registerHealth } from "./health.ts";
import { registerMetrics } from "./metrics.ts";

export interface AppOptions {
  db: Db;
  /** Fastify's own JSON-per-line logger; tests turn it off to keep their output readable. */
  logger?: boolean;
}

export function buildApp({ db, logger = true }: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

  registerHealth(app, db);
  registerMetrics(app, db);

  return app;
}
