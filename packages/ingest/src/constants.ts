/** Two epochs of finality (~12.8 min) plus room for indexing lag (measured 22 s and 35 s). */
export const FINALITY_MARGIN_SECONDS = 900;

/** The gateway served exactly this many rows for `first: 1000` (§9). */
export const PAGE_SIZE = 1000;

export const BACKFILL_HOURS = 48;

/** Below FINALITY_MARGIN_SECONDS, so it warns before there is damage rather than after (§8). */
export const LAG_WARN_SECONDS = 600;

export const RETRY_ATTEMPTS = 3;
export const RETRY_BACKOFF_MS = [250, 500] as const;

/**
 * A hung socket outlives a one-shot process, leaving a scheduler with an invocation that
 * never returns. The abort classifies as transport, so a slow gateway still gets retries.
 */
export const REQUEST_TIMEOUT_MS = 10_000;
