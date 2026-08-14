import { readFileSync } from "node:fs";
import { expect, expectTypeOf, it } from "vitest";
import { FEE_RATE } from "../constants.ts";
import type { PairHourRow } from "../types.ts";
import type { pairHourMetrics } from "./schema.ts";

type Stored = typeof pairHourMetrics.$inferSelect;

// Nothing ties the hand-written domain type to the schema at runtime, so tsc does it here.
// Both directions: a widened column breaks the first, a new column the domain should carry
// breaks the second. `ingestedAt` is deliberately storage-only (§4), hence the Omit.
it("the stored row and the domain type describe the same columns", () => {
  expectTypeOf<Stored>().toExtend<PairHourRow>();
  expectTypeOf<PairHourRow>().toEqualTypeOf<Omit<Stored, "ingestedAt">>();
});

// The rate has one home only while the committed DDL is regenerated after it changes.
// Nothing else in CI would notice the drift: schema.ts, the migration and the live column
// would disagree with every gate still green.
it("the committed migration was generated from the current FEE_RATE", () => {
  const migration = readFileSync(
    new URL("../../migrations/0000_pair_hour_metrics.sql", import.meta.url),
    "utf8",
  );

  expect(migration).toContain(`volume_usd * ${FEE_RATE}`);
});
