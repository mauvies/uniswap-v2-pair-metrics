import { loadConfig } from "./config.ts";
import { createDb, createPool } from "./db/index.ts";
import { createGateway } from "./gateway/index.ts";
import { log } from "./log.ts";
import { EXIT_ABORTED, exitCodeFor, run } from "./run.ts";

const startedAt = Date.now();

async function main(): Promise<number> {
  const config = loadConfig();
  // Pairs run one at a time. The second connection caps the damage if that ever changes.
  const pool = createPool(config.databaseUrl, { max: 2 });
  const db = createDb(pool);
  const gateway = createGateway({ url: config.gatewayUrl });
  const nowInSeconds = Math.floor(Date.now() / 1000);

  try {
    const summary = await run({ db, gateway, nowInSeconds, log });
    const exitCode = exitCodeFor(summary);

    log({
      level: "info",
      event: "run.finished",
      durationMs: Date.now() - startedAt,
      exitCode,
      pairs: summary.pairs,
    });

    return exitCode;
  } finally {
    // An open pg socket keeps the event loop alive. For a scheduler, a one-shot process
    // that never exits is worse than one that fails.
    await pool.end();
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  log({
    level: "error",
    event: "run.aborted",
    reason: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exitCode = EXIT_ABORTED;
}
