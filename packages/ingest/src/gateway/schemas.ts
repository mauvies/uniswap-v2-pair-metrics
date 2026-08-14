import { HOUR_SECONDS } from "@uniswap-v2-pair-metrics/shared";
import { z } from "zod";

/**
 * Plain decimal, no sign and no exponent: the shape verified on 2026-08-13 across the whole
 * range the two pairs span, from `"0.000000008423729439481026545405760632628317"` to
 * `"17594144.06839686623525025832575509"`. Matching only decides whether to admit the
 * string; it is stored unparsed (§3).
 */
const DECIMAL = /^\d+(\.\d+)?$/;

/**
 * `NUMERIC` accepts `'NaN'` and `'Infinity'`, negatives are meaningless for a reserve or a
 * volume, and rows are immutable (§5.1) — so anything admitted here is permanent. This is
 * the only place that validation lives; §4 says why it is not repeated in DDL.
 */
const bigDecimal = z
  .string()
  .refine((value) => DECIMAL.test(value), "expected a finite non-negative decimal");

const txnCount = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .refine(Number.isSafeInteger, "transaction count beyond 2^53");

/** Rejected here rather than at the insert, where it would surface as a constraint name. */
const hourStart = z
  .number()
  .int()
  .positive()
  .refine((value) => value % HOUR_SECONDS === 0, "expected an hour-aligned epoch");

/**
 * What wraps every GraphQL reply. Errors arrive here rather than in the status (§1), so
 * this is what decides whether a 200 was a success.
 */
export const envelope = z.object({
  // A reply carrying errors omits `data` entirely, so neither key can be required.
  data: z.unknown().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export const metaResponse = z.object({
  _meta: z.object({
    block: z.object({ timestamp: z.number().int().positive() }),
    hasIndexingErrors: z.boolean(),
  }),
});

export const pairHoursResponse = z.object({
  pairHourDatas: z.array(
    z.object({
      hourStartUnix: hourStart,
      reserve0: bigDecimal,
      reserve1: bigDecimal,
      reserveUSD: bigDecimal,
      hourlyVolumeToken0: bigDecimal,
      hourlyVolumeToken1: bigDecimal,
      hourlyVolumeUSD: bigDecimal,
      hourlyTxns: txnCount,
    }),
  ),
});

export type Meta = z.infer<typeof metaResponse>["_meta"];
export type PairHour = z.infer<typeof pairHoursResponse>["pairHourDatas"][number];
