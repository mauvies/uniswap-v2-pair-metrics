import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Vitest runs test files in parallel, in separate processes. Every database test writes
    // and clears the same table, so a second file would empty it under the first. Set now,
    // before that file exists, rather than after the flaky failure it would cause.
    fileParallelism: false,
  },
});
