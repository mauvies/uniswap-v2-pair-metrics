# Uniswap v2 pair metrics

Hourly liquidity, volume and fee snapshots for two Uniswap v2 pairs on Ethereum mainnet,
served over HTTP and plotted as APR in a React dashboard.

Data comes from the Uniswap v2 **subgraph**, not from chain scanning — so there is no RPC
client and no log decoding. Reorgs are the indexer's problem rather than ours, with one
exception: ingest holds an hour back behind a 15-minute finality margin before storing it
(`docs/DESIGN.md` §5.2).

## Layout

| Package | Role |
|---|---|
| `packages/shared` | Domain types, pair constants, the APR calculation, database schema |
| `packages/ingest` | One-shot process: backfills 48h, then snapshots when data goes stale |
| `packages/api` | Metrics for a pair over a date range |
| `packages/web` | Dashboard with the APR chart |

Packages are added in the commits that introduce them.

## Requirements

**Node 24 or newer** (`.nvmrc` pins 24), pnpm 10, and Docker. Node 24 is a hard requirement:
TypeScript runs on its native type stripping, so an older runtime fails at the first import
— `engine-strict` catches that at install rather than letting it surface as a parse error.

```sh
pnpm install
cp .env.example .env    # then set THEGRAPH_API_KEY
```

The key comes from [The Graph](https://thegraph.com/studio/apikeys/). Ingest is the only
thing that needs it.

## Commands

Everything runs from the repo root. Nothing needs a database started by hand — the commands
that need one bring it up.

```sh
pnpm test          # all tests; ingest's start the database and migrate it first
pnpm check         # lint and format
pnpm typecheck
pnpm ingest        # one ingest run

pnpm db:up         # Postgres 17 on localhost:5432
pnpm db:down       # stop it; `pnpm db:down -v` drops the data with it
pnpm db:migrate    # apply migrations, starting the database if it is down
pnpm db:reset      # drop everything and migrate from scratch
pnpm db:generate   # regenerate after editing packages/shared/src/schema.ts
```

Set `POSTGRES_PORT` in `.env` if 5432 is taken; the container, the migrations and ingest
all read it. Credentials default to `uniswap` / `uniswap` / `uniswap_v2_pair_metrics`,
local only.

## Ingest

One shot: it collects, writes and exits. Nothing sleeps or loops, so frequent invocation is
safe — the process decides whether there is anything to do. The first run backfills 48
hours; later ones write only the hours that have closed since.

Schedule it with `15 * * * *`, not on the hour: hours are stored once they clear a
15-minute finality margin, so an on-the-hour run would always find the newest hour too
recent (`docs/DESIGN.md` §5.2).

Exit codes: `0` collected or nothing to do, `1` at least one pair failed and the others are
committed, `2` aborted before any was attempted. One JSON line per event to stdout, errors
to stderr.

## Tests

`shared`'s are pure and run anywhere. Ingest's write to a real Postgres, because the
transaction and conflict behaviour `docs/DESIGN.md` §8 promises cannot be pinned against a
fake — so they start the database themselves, and CI runs the same command.

That makes `pnpm test` slower than a pure suite and gives it new ways to fail: Docker not
running, or port 5432 taken. `pnpm --filter @uniswap-v2-pair-metrics/shared test` is the
Docker-free path. And ingest's tests empty the table, so re-run `pnpm ingest` if you wanted
the data back.

## Docs

- [`docs/DESIGN.md`](docs/DESIGN.md) — hypotheses, the APR formula and its derivation, the
  data model, the API contract, failure handling, and what was considered and rejected.

Run instructions for the services land with the code they describe.
