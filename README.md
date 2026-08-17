# Uniswap v2 pair metrics

Hourly liquidity, volume and fee snapshots for two Uniswap v2 pairs on Ethereum mainnet,
served over HTTP and plotted as APR in a React dashboard.

Data comes from the Uniswap v2 **subgraph** rather than from chain scanning. Ingest holds
each hour back behind a 15-minute finality margin, so the newest stored point is always at
least that far behind the clock (`docs/DECISIONS.md` §5.2).

## Layout

| Package | Role |
|---|---|
| `packages/shared` | Domain types, the API response shape, pair constants, the APR calculation, database schema and pool |
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
pnpm dev           # the whole stack: one ingest run, the API, the dashboard
pnpm down          # stop the containers it left running

pnpm test          # all tests, against a database of their own
pnpm check         # lint and format
pnpm typecheck
pnpm ingest        # one ingest run
pnpm api           # the metrics service on http://127.0.0.1:3000
pnpm web           # the dashboard on http://localhost:4000

pnpm db:up         # Postgres 17 on localhost:5432
pnpm db:down       # stop it; `pnpm db:down -v` drops the data with it
pnpm db:migrate    # apply migrations, starting the database if it is down
pnpm db:reset      # delete the volume with every row in it, then migrate from scratch
pnpm db:generate   # regenerate after editing packages/shared/src/db/schema.ts
```

Export `POSTGRES_PORT` if 5432 is taken; the container, the migrations, the tests and the
services all read it. `.env` is not enough for that one — compose and the two services read
it, but the migrations and the tests do not, so a port set only there moves the container
out from under them. Credentials default to `uniswap` / `uniswap` /
`uniswap_v2_pair_metrics`, local only.

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
recent (`docs/DECISIONS.md` §5.2).

Exit codes: `0` collected or nothing to do, `1` at least one pair failed and the others are
committed, `2` aborted before any was attempted. One JSON line per event to stdout, errors
to stderr.

## API

`GET /pairs/:address/metrics?from=<ISO-8601>&to=<ISO-8601>` returns every stored metric for
one pair over a range, plus APR over 1, 12 and 24 hours at each point. Both bounds are
optional and inclusive, floored to their hour; omit them to get everything stored. Hours the
subgraph never wrote come back reconstructed and flagged `imputed: true` (`docs/DECISIONS.md`
§2.3), and `range` echoes the interval actually served rather than the one asked for.

```sh
curl -s "http://127.0.0.1:3000/pairs/0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc/metrics" | jq
```

`GET /health` reports whether the database is reachable and how old each pair's newest
stored hour is, counted from the end of that hour — the same reference the ingest guard
measures staleness from (`docs/DECISIONS.md` §5.1). A pair with no rows reports `null` for
both: that is the dead pair's steady state, not a fault. With the database down the endpoint
answers `503`, and it recovers on its own once the database is back — no restart.

Two ways to run it, one entry point:

```sh
pnpm api                          # on the host, against localhost
docker compose up -d --wait api   # in a container, against the compose network
```

`pnpm api` migrates first, so it works on a fresh clone. The container path starts the
database and waits until it is healthy, and builds the image the first time, but it does
**not** migrate — run `pnpm db:migrate` once before the first containerised run, or the
healthcheck never passes, `--wait` gives up and every read answers `503`. Migrating afterwards
recovers it within one check, but `--wait` fails fast against a container already marked
unhealthy, so run it again to see it. The image holds a copy of the source, so rebuild it with
`docker compose build api` after editing `packages/api` or `packages/shared`.

Either way it answers on `http://127.0.0.1:3000`, the address the dashboard's proxy targets,
so `pnpm web` works against both — but only one of them can hold the port at a time. Set
`PORT` in `.env` to move it; the published port follows and the container keeps 3000 inside.
`HOST` moves the host-run service only, and binds loopback by default.

## Dashboard

```sh
pnpm web
```

Vite serves it on http://localhost:4000, or the next free port if that one is taken.

The chart reads the metrics service through the dev server's proxy, so the API has to be
running alongside it and the table has to hold at least one ingested hour. `pnpm dev` arranges
all three from one terminal — it ingests once, starts the API in its container, and leaves
Vite in the foreground:

```sh
pnpm dev       # from a clone: ingest, API, dashboard
pnpm down      # the containers outlive the dashboard; this stops them
```

It needs port 3000 free, so stop a host-run `pnpm api` first. The three commands underneath it
are still the way to run the API on the host, or to restart one piece without the others:

```sh
pnpm ingest    # once, if the table is empty
pnpm api       # one terminal
pnpm web       # another
```

Without the API the chart is empty and the rest of the page still renders — the metric cards
are hardcoded.

## Tests

```sh
pnpm test          # everything
pnpm --filter @uniswap-v2-pair-metrics/shared test    # the Docker-free subset
```

`shared`'s tests are pure. Ingest's and the API's write to a real Postgres, because the
transaction and conflict behaviour `docs/DECISIONS.md` §8 promises cannot be pinned against a
fake. They empty the table between tests, so they run against a database of their own that
`pnpm test` creates and migrates — development data is never touched.

## Docs

- [`docs/DECISIONS.md`](docs/DECISIONS.md) — hypotheses, the APR formula and its derivation, the
  data model, the API contract, failure handling, and what was considered and rejected.
- [`docs/STYLING.md`](docs/STYLING.md) — the Figma extraction: the colour, type,
  radius and elevation primitives behind the `@theme`, per-section geometry, and what the
  design leaves undefined.

Run instructions for the services land with the code they describe.

## Attribution

The five icons in the dashboard's Performance card header are
[Line Awesome](https://icons8.com/line-awesome) glyphs by Icons8, shipped as inline SVG
rather than the font. Line Awesome is dual-licensed: the fonts under SIL OFL 1.1, everything
else under MIT.
