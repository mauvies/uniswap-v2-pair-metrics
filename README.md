# Uniswap v2 pair metrics

Hourly liquidity, volume and fee snapshots for two Uniswap v2 pairs on Ethereum mainnet,
served over HTTP and plotted as APR in a React dashboard.

Data comes from the Uniswap v2 **subgraph**, not from chain scanning — so there is no RPC
client, no log decoding and no confirmation depth here.

## Layout

| Package | Role |
|---|---|
| `packages/shared` | Domain types, pair constants, the APR calculation, database schema |
| `packages/ingest` | One-shot process: backfills 48h, then snapshots when data goes stale |
| `packages/api` | Metrics for a pair over a date range |
| `packages/web` | Dashboard with the APR chart |

Packages are added in the commits that introduce them.

## Requirements

**Node 24 or newer** (`.nvmrc` pins 24), pnpm 10, Docker for Postgres, and a
[The Graph gateway API key](https://thegraph.com/studio/apikeys/).

Node 24 is a hard requirement, not a preference. TypeScript files run directly on its
native type stripping, so there is no transpiler in the loop and an older runtime fails at
the first import. `engine-strict` catches that at `pnpm install` with an explicit message
rather than letting it surface later as a confusing parse error.

## Database

Set `POSTGRES_PORT` in a `.env` file first if 5432 is already taken — both commands below
read it.

```sh
docker compose up -d db    # Postgres 17, localhost:5432
pnpm db:migrate            # create the schema
docker compose down        # add -v to drop the data too
```

Changing `packages/shared/src/schema.ts` means regenerating the migration with
`pnpm db:generate` and committing the `.sql` alongside it.

Credentials default to `uniswap` / `uniswap` / `uniswap_v2_pair_metrics` and are local only.
`POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` override them the same way.

## Docs

- [`docs/DESIGN.md`](docs/DESIGN.md) — hypotheses, the APR formula and its derivation, the
  data model, the API contract, failure handling, and what was considered and rejected.

Run instructions for the services land with the code they describe.
