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
| `packages/shared` | Domain types, pair constants, the APR calculation, database schema and pool |
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
pnpm test          # all tests; the database is started and migrated first
pnpm check         # lint and format
pnpm typecheck
pnpm ingest        # one ingest run
pnpm api           # the metrics service on http://127.0.0.1:3000

pnpm db:up         # Postgres 17 on localhost:5432
pnpm db:down       # stop it; `pnpm db:down -v` drops the data with it
pnpm db:migrate    # apply migrations, starting the database if it is down
pnpm db:reset      # delete the volume with every row in it, then migrate from scratch
pnpm db:generate   # regenerate after editing packages/shared/src/db/schema.ts
```

Set `POSTGRES_PORT` in `.env` if 5432 is taken; the container, the migrations and ingest
all read it. Credentials default to `uniswap` / `uniswap` / `uniswap_v2_pair_metrics`,
local only.

## Ingest

One shot: it collects, writes and exits. Nothing sleeps or loops, so frequent invocation is
safe — the process decides whether there is anything to do. The first run backfills 48
hours; later ones write only the hours that have closed since.

Two ways to run it, one entry point:

```sh
pnpm ingest                      # on the host, against localhost
docker compose run --rm ingest   # in a container, against the compose network
```

`pnpm ingest` migrates first, so it works on a fresh clone. The container path starts the
database and waits until it is healthy, and builds the image the first time, but it does
**not** migrate — run `pnpm db:migrate` once before the first containerised run, or both
pairs fail and it exits `1`. The image holds a copy of the source, so rebuild it with
`docker compose build ingest` after editing `packages/ingest` or `packages/shared`.

Schedule either with `15 * * * *`, not on the hour: hours are stored once they clear a
15-minute finality margin, so an on-the-hour run would always find the newest hour too
recent (`docs/DESIGN.md` §5.2).

Exit codes: `0` collected or nothing to do, `1` at least one pair failed and the others are
committed, `2` aborted before any was attempted. One JSON line per event to stdout, errors
to stderr.

## API

```sh
pnpm api
```

`GET /health` reports whether the database is reachable and how old each pair's newest
stored hour is, counted from the end of that hour — the same reference the ingest guard
measures staleness from (`docs/DESIGN.md` §5.1). A pair with no rows reports `null` for
both: that is the dead pair's steady state, not a fault. With the database down the endpoint
answers `503`, and it recovers on its own once the database is back — no restart.

Set `PORT` or `HOST` in `.env` to move it. It binds loopback by default.

## Tests

`shared`'s are pure and run anywhere. Ingest's and the API's write to a real Postgres,
because the transaction and conflict behaviour `docs/DESIGN.md` §8 promises cannot be
pinned against a fake. `pnpm test` starts and migrates the database once, then runs the
packages one at a time — CI runs that same command.

Both database suites share the one table and empty it between tests, which is why the fan-out
is sequential: in parallel they would clear the table under each other's assertions. Re-run
`pnpm ingest` afterwards if you wanted the data back.

That makes `pnpm test` slower than a pure suite and gives it new ways to fail: Docker not
running, or port 5432 taken. `pnpm --filter @uniswap-v2-pair-metrics/shared test` is the
Docker-free path. The other two filtered commands run `vitest` alone and expect a database
already migrated; they fail naming the command that fixes it.

## Docs

- [`docs/DESIGN.md`](docs/DESIGN.md) — hypotheses, the APR formula and its derivation, the
  data model, the API contract, failure handling, and what was considered and rejected.

Run instructions for the services land with the code they describe.
