import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createDb, createPool } from "./db/index.ts";

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const app = buildApp({ db: createDb(pool) });

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  // A port already taken is the common one, and Fastify does not log it itself.
  app.log.error(error);
  process.exit(1);
}
