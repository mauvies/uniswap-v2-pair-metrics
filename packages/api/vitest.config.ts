import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Vitest runs test files in parallel, in separate processes. Both database test files
    // here write and clear the same table, so in parallel they would empty it under each other.
    fileParallelism: false,
  },
});
