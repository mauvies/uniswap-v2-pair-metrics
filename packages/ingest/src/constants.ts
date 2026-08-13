/**
 * How far behind the indexer head an hour must be before it is safe to store.
 *
 * Ethereum finalises two epochs back, ~12.8 minutes, but we read the subgraph rather than
 * the chain and a finalised block still has to be indexed (measured lag: 22 s and 35 s).
 * 15 minutes is two epochs plus room for that. Rows are immutable (§5.1), so an hour built
 * from blocks that later reorg would be wrong permanently.
 */
export const FINALITY_MARGIN_SECONDS = 900;

/** The gateway served exactly this many rows for `first: 1000` (§9). */
export const PAGE_SIZE = 1000;

/** Attempts per request, and the sleeps between them. */
export const RETRY_ATTEMPTS = 3;
export const RETRY_BACKOFF_MS = [250, 500] as const;

/**
 * A hung socket outlives a one-shot process, which is worse than a failure: a scheduler
 * ends up with an invocation that never returns. The abort classifies as transport, so a
 * slow-but-alive gateway still gets its retries.
 */
export const REQUEST_TIMEOUT_MS = 10_000;
