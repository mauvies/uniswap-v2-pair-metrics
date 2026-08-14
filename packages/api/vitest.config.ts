import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Same reason as ingest's: every database test here writes to the one
    // `pair_hour_metrics` table and empties it between tests, so two files running in
    // parallel would clear the table under each other's assertions.
    fileParallelism: false,
  },
});
