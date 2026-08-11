# Uniswap v2 pair metrics

Hourly liquidity, volume and fee snapshots for two Uniswap v2 pairs on Ethereum mainnet,
served over HTTP and plotted as APR in a React dashboard.

Data comes from the Uniswap v2 **subgraph**, not from chain scanning — the indexer absorbs
reorgs, so there is no RPC client and no confirmation depth here.

## Layout

| Package | Role |
|---|---|
| `packages/shared` | Domain types, pair constants, the APR calculation, database schema |
| `packages/ingest` | One-shot process: backfills 48h, then snapshots when data goes stale |
| `packages/api` | Metrics for a pair over a date range |
| `packages/web` | Dashboard with the APR chart |

Packages are added in the commits that introduce them.

## Requirements

Node 22+ (24 recommended, see `.nvmrc`), pnpm 10, Docker for Postgres, and a
[The Graph gateway API key](https://thegraph.com/studio/apikeys/).

Run instructions, the data model, and design decisions land with the code they describe.
