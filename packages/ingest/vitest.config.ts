import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Vitest runs files in parallel by default, in separate processes. Every database test
    // writes to the one `pair_hour_metrics` table and empties it between tests, so a second
    // database file would clear the table under the first one's row-count assertions. Only
    // `run.db.test.ts` touches it today: this is here before the second file rather than after
    // the intermittent failure it would cause
    fileParallelism: false,
  },
});
