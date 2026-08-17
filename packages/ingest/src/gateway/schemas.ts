import { HOUR_SECONDS } from "@uniswap-v2-pair-metrics/shared";
import { z } from "zod";

/**
 * Plain decimal: no sign, no exponent. Verified on 2026-08-13 over the whole range the two
 * pairs span, from `"0.000000008423729439481026545405760632628317"` to
 * `"17594144.06839686623525025832575509"`. The string is stored unparsed (§3).
 */
const DECIMAL = /^\d+(\.\d+)?$/;

/** Finite and non-negative, checked here and nowhere else (§5.4). */
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

/** Errors arrive in the body, not the status (§1), so this decides whether a 200 succeeded. */
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
