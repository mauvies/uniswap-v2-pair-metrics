/** Two epochs of finality, plus room for indexer lag (§5.2). */
export const FINALITY_MARGIN_SECONDS = 900;

/** The gateway's own limit: `first: 1000` returned exactly this many (§9). */
export const PAGE_SIZE = 1000;

export const BACKFILL_HOURS = 48;

/** Lower than FINALITY_MARGIN_SECONDS, so it warns before the data is wrong (§8). */
export const LAG_WARN_SECONDS = 600;

export const RETRY_ATTEMPTS = 3;

export const RETRY_BACKOFF_MS = [250, 500] as const;

/**
 * Without a timeout, a hung request keeps this one-shot process alive for good. The abort
 * counts as a transport failure, so a slow gateway is still retried.
 */
export const REQUEST_TIMEOUT_MS = 10_000;
