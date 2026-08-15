# Design

Hypotheses, decisions and failure handling. Written before the code and updated in the
commit that changes it, so it doubles as the backlog. Most of it becomes the README.

The exercise leaves several definitions open and invites documented assumptions. Each one
below is marked **verified** (checked against the live gateway, 11–12 August 2026) or
**decided** (a choice, with its alternative in §9).

---

## 1. Data source

Uniswap v2 on Ethereum mainnet via subgraph `A3Np3RQbaBA6oKJgiwDJeo5T3zrYfGHPWFYayMwtNDum`
on The Graph's gateway (`POST https://gateway.thegraph.com/api/{key}/subgraphs/id/{id}`).
Indexed source, not chain scanning: no RPC, no log decoding, and no reorg handling of our
own beyond a finality margin on the ingest bound (§5.2).

Entity `pairHourDatas` (verified):

| Field | Type | Use |
|---|---|---|
| `hourStartUnix` | `Int` | Hour bucket, already aligned at source |
| `reserve0`, `reserve1` | `BigDecimal` | Raw reserves; stored, never in arithmetic |
| `reserveUSD` | `BigDecimal` | Liquidity — the APR denominator |
| `hourlyVolumeToken0/1` | `BigDecimal` | Volume in coin amounts (§4) |
| `hourlyVolumeUSD` | `BigDecimal` | Volume — the fee basis |
| `hourlyTxns` | `BigInt` | Transaction count |

All `BigDecimal` values arrive as strings. Ids are `{pairAddress}-{hourStartUnix / 3600}`.

**Findings that shaped the design** (all verified):

- No `fees` field; fees are derived from volume (§2.1).
- Hours with no pool activity produce no entity — gaps are normal (§2.3).
- A row can have `hourlyTxns > 0` and `hourlyVolumeUSD = 0`: mints and burns are
  transactions without volume. "Row exists" ≠ "there was trading".
- Every error returns HTTP 200 with an `errors` array, including auth failures. Retry
  classification cannot key on status code (§8).
- `_meta { block { timestamp } hasIndexingErrors }` exists; lag measured at 22 s and 35 s on
  two probes. Load-bearing in §5.2.

**The two pairs:**

| Address | Pair | State |
|---|---|---|
| `0xb4e16d…c9dc` | USDC/WETH | Active, ~$17.7M reserves, 1,000 consecutive hours with no gap |
| `0xbc9d21…2a22` | WETH/RKFL | Inactive since 2022-11-29 |

WETH/RKFL holds 46 hourly records in total; liquidity was withdrawn in November 2022 and
`reserveUSD` fell to ~8×10⁻⁹, so a 48-hour backfill returns zero rows. **Confirmed with
Sentora that the pair is deliberately part of the exercise, to evaluate how an empty series
is handled, and that both addresses are to be kept as given.**

The empty case is therefore a specified behaviour rather than a degenerate path, and is
first-class in all three services: ingest writes nothing and exits 0, the API returns an
empty result rather than an error, and the UI renders a designed empty state (§8). It also
happens to be the general case — any pair can go quiet for 48 hours.

---

## 2. Domain

### 2.1 Fees are 0.30% of volume — decided

`feesUSD = hourlyVolumeUSD × 0.003`

Uniswap v2 charges a flat 0.30% per swap, and the factory's `feeTo` switch has never been
activated on mainnet, so all of it accrues to LPs (with it active, LPs get 0.25%). The
subgraph exposes no fee field and we have no RPC, so this is a hypothesis, not a
verification. `hourlyVolumeUSD` is *tracked* volume, priced through a token whitelist:
accurate for USDC/WETH, can understate exotic pairs.

### 2.2 APR — decided

```
                Σ feesUSD over the N hours ending at t        8760
APR(t, N)  =  ───────────────────────────────────────────  ×  ────  ×  100
                            reserveUSD(t)                        N
```

Fees actually earned in the trailing N-hour window, scaled to a year, over the capital in
the pool when that window closes: `reserveUSD(t)` is read at t itself, the final hour of
the window. `N ∈ {1, 12, 24}` is the exercise's moving-average window.

We use point-in-time `reserveUSD` to match standard pool dashboards. While this works well
for stable pairs like USDC/WETH (where both methods differ by <0.1 percentage points of
APR), it fails when liquidity collapses. In pools like WETH/RKFL — which dropped from
$189.7k to near zero — dividing earlier fees by a tiny remaining balance artificially
inflates the APR. (§9 details the window-averaged alternative.)

Worked example, the 24 hours to 12 August 2026 09:00 UTC: $237,045 of volume × 0.003 =
$711 in fees, ×365 = $259,566 a year. Over `reserveUSD(t)` = $17,689,023 that is
**1.467%**; over the window mean of $17,585,645 it would be 1.476% — a 0.009-point
difference, inside the 0.1-point bound above. Reserves rose slightly across this window,
so point-in-time reads marginally lower here; in a collapse it goes the other way, and far
harder. 1.467% was the newest complete point at measurement and the 48-hour high: the top
of the plotted range, not its middle.

### 2.3 Gaps are reconstructed, not imputed — verified premise, decided handling

The subgraph creates an hour record only when something changes the pool's reserves — a
swap, a mint, a burn, a sync. So a missing hour is not missing information. It tells us what
happened during that hour: nothing. Reserves held steady and no fees were earned.

That is what makes filling the gap safe. We use zero volume and carry the last known
liquidity forward, and the result is what the hour actually looked like rather than a guess.
Points filled this way carry `imputed: true`, so nothing downstream mistakes them for
observations.

Two things follow.

**The moving average has to work in time, not in rows.** Averaging "the last 24 rows" covers
a different span of time every time the series has a gap in it.

**The stored series has to be contiguous.** Here the same reasoning cuts the other way. A row
can also be missing because ingest never fetched that hour, and in the table those two cases
look identical. If ingest came back from a week of downtime and resumed at the present, the
API would fill that week with zeros and serve it as observed data. So ingest always picks up
from `MAX(hour_start_unix) + 1h` and works forward, however long it was away. Catch-up is
never capped: a cap would leave exactly the kind of hole we cannot tell apart from a quiet
period.

A testing consequence: USDC/WETH shows no gap in 1,000 verified hours (§1) and the dead pair
has no recent rows at all, so no live series exercises reconstruction. The gap tests build
their series synthetically.

### 2.4 Warm-up points are `null` — decided

With 48 hours of history and `N = 24`, the first 23 points have an incomplete window and are
`null`. A partial window changes what the number means — the first point of a "24h average"
would be a 1-hour APR — and makes the left edge of the chart unstable. Null counts (0, 11,
23 for N = 1, 12, 24) are asserted in tests. Those are the counts whenever the series is
longer than the window; a series shorter than the window is null throughout, which is how an
almost-empty pair renders.

### 2.5 UTC throughout — decided

`hourStartUnix` arrives hour-aligned, so the system never buckets timestamps. The only time
arithmetic is the current hour boundary for the staleness guard. Axis labels render in UTC:
unambiguous for any reviewer, no DST.

---

## 3. Architecture

```
packages/
  shared/   domain and contract types, pair constants, APR function, schema, connection pool
  ingest/   one-shot: subgraph client, staleness guard, upsert
  api/      pair metrics over a date range
  web/      dashboard and APR chart
```

**pnpm workspaces, no build orchestrator** — four packages; caching would not pay for
itself.

**Nothing compiles across package boundaries.** `shared` is consumed as TypeScript source:
its `exports` names `src/index.ts` and it emits nothing. Consumers bundle it instead —
esbuild for the API's container image, Vite for the web app — so `tsc` is a typechecker
everywhere in this repo and never a build step. That is what keeps build ordering out of a
workspace with no orchestrator: no package has to be built before another can compile.

Verified on 2026-08-13 by bundling a package that imports `shared` by name: 1.4 kB of
self-contained ESM, no external dependencies, runs on plain Node. The drizzle schema is
reached through a `./schema` subpath rather than the barrel, because a top-level
`pgTable(...)` call cannot be proven side-effect-free: re-exporting it pinned 74 kB of
column builders into every consumer, including the browser bundle `web` will produce.

The pool and the drizzle instance sit behind a second subpath, `./db`, once ingest and the
API turned out to open the same connection two ways. Re-measured on 2026-08-14: the barrel
bundles to 1,549 bytes with no drizzle or pg symbols in it, and `pg` does not bundle for a
browser at all — esbuild fails to resolve `net`, `events` and `util`. So this boundary holds
harder than the schema's: leaking the schema was silent weight, leaking the connection
breaks the web build. `max` stays with the caller, since one pair at a time and concurrent
requests want different pools.

Both subpaths, and `databaseUrl`, live under `src/db/` — one place for everything that
answers "how do we talk to Postgres", separate from the domain code the barrel exports.
`./schema` and `./db` still name two files there, never a folder index: an index re-exporting
both would drag the schema back through `./db`.

A third subpath, `./test-helpers`, holds what ingest's and the API's database tests turned
out to need identically — `testPool`, `assertReachable`, and the two configured pair
addresses under the names the tests read by. Each package keeps its own gateway stubs or
row fixtures locally; only the parts that were already the same file twice moved. The
filename ends `.test-helpers.ts` for the same reason it does in ingest and the API: vitest
never collects it as a suite, and `.dockerignore`'s `**/*.test-helpers.ts` keeps it, and
what it pulls in, out of both container images.

**§6.1's response shape lives in `shared`, not in `api`.** `web` reads the same three types
the route returns — `PairMetrics`, `MetricPoint`, `ResolvedRange` — and a contract
redeclared on the client drifts from the server with nothing to catch it. That is the
connection pool's trigger, a second consumer, applied one commit before the consumer lands:
the shape is fixed by §6.1 and pinned by the route's tests, so there is nothing left to
guess. Types erase, so this costs the bundle nothing: the barrel emits byte-identical
output before and after the move, checked on 2026-08-14, and the measurement above stands.
What stays in `api` is the logic that builds the shape — flooring, the lookback, the
resolve — and `StoredExtent`, which describes stored rows rather than the wire.

**Node 24 or newer, and the version is load-bearing.** Native type stripping runs `.ts`
files with no transpiler, so no application code is transpiled and there is no `tsx`
dependency of ours — `drizzle-kit` bundles one to read its own config, which runs only at
migration time. An older runtime fails at the first import rather than at install, so
`engine-strict` turns that into an error `pnpm install` can explain.

**APR is computed in JS, in `shared`, not in SQL.** Window functions get awkward once the
series has gaps, and a pure function can be tested against hand-computed fixtures.

**Precision.** Subgraph returns strings → `NUMERIC` columns → Drizzle returns strings. No
float touches the persistence path. `Number()` is called in exactly one place: inside the
APR function, on `reserveUSD` and the summed fees. Safe because those are USD values below
10⁸ — reserves measured at 1.8×10⁷ — against 15–16 significant digits, output to three
decimals. `reserve0`/`reserve1` are raw token amounts, stored and served as strings, never
in arithmetic.

---

## 4. Data model

```sql
CREATE TABLE pair_hour_metrics (
  pair_address    text     NOT NULL,
  hour_start_unix integer  NOT NULL
    CHECK (hour_start_unix > 0 AND hour_start_unix % 3600 = 0),
  reserve0        numeric  NOT NULL,
  reserve1        numeric  NOT NULL,
  reserve_usd     numeric  NOT NULL,
  volume_token0   numeric  NOT NULL,
  volume_token1   numeric  NOT NULL,
  volume_usd      numeric  NOT NULL,
  fees_usd        numeric  GENERATED ALWAYS AS (volume_usd * 0.003) STORED NOT NULL,
  hourly_txns     bigint   NOT NULL,
  ingested_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pair_address, hour_start_unix)
);
```

- **The primary key is the natural key**, so idempotency is a schema property, not
  application logic.
- **Integer epoch hours, not `timestamptz`**: matches the source, no timezone surface, and
  the invariant — positive, hour-aligned — is enforceable as a `CHECK`. The cost is a
  ceiling. Postgres `integer` is signed 32-bit, so the column stops accepting values after
  2038-01-19T03:14:07Z. The source has the same ceiling — `hourStartUnix` is a GraphQL
  `Int`, which is also signed 32-bit — so widening the column on its own would buy no real
  headroom while the data still arrives through a 32-bit field. Deliberately left as is;
  `bigint` is a one-line migration on the day the subgraph widens first.
- **`fees_usd` is generated.** The exercise asks for fees to be stored; deriving them in the
  schema satisfies that while making drift from `volume_usd` impossible, and the derivation
  is visible in the migration. The trade-off is that §2.1 is a hypothesis cemented in DDL:
  revising the rate means a migration, not a constant. The rate itself is rendered into the
  DDL from `FEE_RATE`, so it has one home in source; a test asserts the committed migration
  still matches it, since regenerating is a manual step nothing else would catch.
- **The numeric columns carry no value constraints, deliberately.** `NUMERIC` accepts
  `'NaN'` and `'Infinity'`, and since NaN sorts above every number the obvious `>= 0`
  rejects neither, so a constraint that looked sufficient would not be. But that argues the
  validation must be complete, not that it belongs here: the zod schema at the fetch
  boundary (§5.4) is what rejects a malformed field, and it names the field in the error
  instead of surfacing as a constraint violation inside a transaction. Duplicating it in
  DDL would say we do not trust our own boundary. The alignment `CHECK` above is a
  different thing — a structural invariant of the primary key, true of any write.
- **Volume is stored twice, in coins and in USD.** The exercise's introduction describes all
  three metrics in coins; requirement 1 names them with no unit at all. APR needs a common
  monetary unit — fees in one token cannot be divided by reserves in another — so the
  calculation uses `volume_usd`, while `volume_token0/1` keep the coin reading the
  introduction asks for. Fees are the asymmetry: `fees_usd` is USD only, because the
  subgraph exposes no fee field and reconstructing one per token would need to know which
  side of each swap paid it, which the hourly aggregate does not preserve.
- **`hourly_txns` is stored for diagnosis, not calculation.** It is what separates a quiet
  hour from a mint or burn — the evidence behind §1's "row exists ≠ there was trading" —
  and the cheapest sign of life when reading the table directly. Nothing computes on it and
  the API does not serve it.
- **`ingested_at` exists to be asserted on**: the "second run writes nothing" test checks
  it, which a row count cannot.
- No `is_partial`, no `updated_at` — rows are immutable (§5.1).

Pair symbols live in `shared` as constants, not a table (§9). Migrations use `drizzle-kit
generate` + `migrate`, never `push`; the `.sql` files are committed as the readable form of
the data model.

---

## 5. Ingest

### 5.1 Only completed hours are ingested — decided

The hour in progress is still collecting volume. Store it and the APR for that point comes
out too low, and stays too low until something overwrites it. The usual fix is to store it
anyway and mark it partial. We do the opposite: ingest waits, and writes an hour only once
it has ended.

That pays off twice. Staleness can then be measured from the end of the last stored hour,
and "the last stored hour ended over 60 minutes ago" turns out to mean "a new hour has
finished upstream and is old enough to store" — so the guard fires once an hour, shifted
into the cycle by the finality margin (§5.2) rather than sitting on the boundary. And
every row we store is final, which is what lets the upsert be `ON CONFLICT DO NOTHING` and
makes a second run a provable no-op.

The cost is that the newest point on the chart is the last completed hour, never the one
still running.

**Reading the 60-minute rule.** The brief triggers a snapshot when the last saved data point
is older than 60 minutes, without saying from when that age is counted. An hourly point
spans an interval, so its age can be measured from `hour_start` or from the hour's end. We
measure from the end: a point is not complete until its hour closes, and measuring from the
start would fire an hour earlier, when the only thing left to snapshot is the hour still in
progress — which the completed-hours rule above excludes. Either reading gives the same
cadence, one write per hour just after a new hour becomes available.

### 5.2 "Now" is bounded by the indexer — decided

```
effectiveNow = min(wall clock, _meta.block.timestamp) − 900
```

An hour complete by wall clock may not be fully indexed. Combined with immutable rows,
ingesting a half-indexed hour would freeze incomplete data permanently. Bounding "now" by
the indexer's head means an hour is ingested only once the indexer has passed its end.
`_meta` is already fetched per run, so this is free, and it removes host clock skew too. If
the indexer falls far behind, the run is a logged no-op.

**The 900 seconds are a finality margin**, and they do something the `min` does not. The
indexer bound says an hour is fully *indexed*; it says nothing about whether the blocks it
was built from are *final*. Ethereum finalises two epochs back, about 12.8 minutes, and a
finalised block still has to be indexed — measured lag was 22s and 35s. 15 minutes covers
both and explains itself. Without it, a reorg in the last minutes of an hour leaves that row
permanently wrong, because rows are never updated (§5.1).

How much that matters is a property of the pool, not of the method. APR divides fees by
`reserveUSD`, so a reorg moves numerator and denominator against the size of the pool: $50k
of swap is noise against USDC/WETH's $17.7M and a quarter of a $200k pool. §9 justifies
having no pairs table by saying adding a pair is a one-line change, so the guarantee would
degrade silently the first time someone added an illiquid one.

**The margin is subtracted after the `min`, not before.** That runs the finality test on
`_meta.block.timestamp` — chain time — rather than on the host clock, which is the same
reason the bound exists at all. Subtracting from the wall clock instead would let a host
15 minutes fast write hours with no margin. The cost is that a lagging indexer and the
margin compound; that only bites in a state already worth warning about, and conservative
is the right bias when the write cannot be undone. Running without the margin is in §9.

**If the `_meta` query fails, the run aborts.** There is no fallback to the wall clock:
that would reinstate exactly the corruption this bound exists to prevent, and would do so
precisely when the gateway is misbehaving.

### 5.3 Staleness reference is `MAX(hour_start_unix)` — decided

The exercise triggers on the age of the last *saved data point*, so the reference is read
from the table itself — not a timer, not a "last run" record, and no cursor table. The data
is its own cursor, so there is no run-state that can drift ahead of what was committed.

Per pair, not global, and not "last attempt": a pair with no rows is always due. Each run
queries it, finds nothing, writes nothing, exits 0 — one cheap query, and a revived pair
heals itself.

### 5.4 Subgraph client — decided

**No GraphQL client.** `fetch` plus a zod schema at the boundary, so a renamed or nulled
field surfaces as an error instead of a `NaN` reaching the chart. Every `BigDecimal` is
checked to parse as a finite, non-negative decimal — `'NaN'` and `'Infinity'` are values
`NUMERIC` would accept downstream, and rows are immutable (§5.1), so anything admitted here
is permanent. This is the only place that validation lives; §4 says why not in DDL too.

**No retry library.** The loop is a dozen lines; the interesting part is the classification,
which is specific to this gateway (§8).

### 5.5 Lifecycle

Per pair, independently:

1. Read `MAX(hour_start_unix)`. Due if there are no rows, or if a complete unstored hour
   exists; otherwise log and exit 0. An empty pair is due every run by design — one cheap
   query, and a revived pair heals itself (§5.3).
2. Fetch `pairHourDatas` where `hourStartUnix >= lowerBound AND < effectiveCurrentHour` —
   lower bound is `effectiveCurrentHour − 48 × 3600` on the first run, `lastStored + 3600`
   after; half-open, so the in-progress hour is excluded and a first backfill spans
   **exactly 48 hours** of complete indexed time, whatever the indexer's lag. One
   query whatever the gap: no branch for backfill versus incremental versus catch-up.
   Explicit `first`, `orderBy: hourStartUnix` ascending (§9). `effectiveCurrentHour` is
   computed once per run; an hour completing mid-run is picked up by the next.
3. Validate with zod, then write in one transaction for that pair with `INSERT … ON CONFLICT
   DO NOTHING`. A response that fails validation is never persisted.
4. A failure on one pair leaves every other pair's committed data intact; the run exits
   non-zero and the failed pair heals on the next run.

Two properties of step 2 carry weight. The window is an interval, not a count: a quiet hour
produces no entity, so 48 hours yields 48 rows only for a pair that traded in every one of
them, and the boundary test asserts the interval. And the lower bound never skips forward —
catch-up is uncapped however long the gap, which is what keeps the stored series contiguous
and lets the API read a missing hour as quiet rather than unfetched (§2.3).

One rule — *fetch from the last saved hour to the current completed hour, act only if that
is older than the threshold* — produces every case, with no special branches:

| Situation | `MAX(hour_start)` | Action |
|---|---|---|
| First run | empty | Backfill 48h |
| Run within the hour | 20 min ago | Nothing, exit 0 |
| Run after a new hour completed, margin not yet passed | 65 min ago | Nothing, exit 0 |
| Run once the margin has passed | 75 min ago | Ingest that hour |
| Run after three days down | 72h ago | Fetch the 72h interval, write the rows it holds |
| Inactive pair | empty, every run | Query 48h, find nothing, exit 0 |

The 60-minute guard lives inside the process, so frequent invocation is safe — the process
decides whether there is anything to do. Two invocation modes, one entry point: `pnpm
ingest` against a database on localhost, and `docker compose run --rm ingest` against the
compose network — either of them driven by a cron line. Nothing sleeps or loops internally. The cron line is `15 * * * *`, not `0 * * * *`: on the hour the
newest hour has not cleared the margin yet, so every run would find nothing and each write
would land an hour late.

---

## 6. API

### 6.1 Contract

```
GET /pairs/:address/metrics[?from=<ISO-8601>][&to=<ISO-8601>]
→ 200 {
    pair:  { address, token0Symbol, token1Symbol },
    range: { fromHourUnix, toHourUnix },
    points: [{
      hourStartUnix, reserve0, reserve1, liquidityUSD,
      volumeToken0, volumeToken1, volumeUSD, feesUSD,
      imputed: boolean,
      apr: { "1": number|null, "12": number|null, "24": number|null }
    }]
  }

GET /health
→ 200 { ok, db, pairs: [{ address, lastHourStartUnix, ageSeconds }] }
```

- **The response carries every stored metric**, not only what the chart consumes: the brief
  asks for a service that retrieves the metrics for a pair and range, not an endpoint shaped
  to one client.
- **Reconstruction is only valid inside `[first_stored_hour, last_stored_hour]`.** Within
  that interval a missing hour means no activity, so it comes back with `imputed: true`
  (§2.3). Outside it — at *either* end — nothing is known, so hours are omitted rather than
  imputed. Hours past `last_stored_hour` are un-ingested, not quiet; imputing them would
  present a gap in coverage as observed zero-volume data, which is the same corruption
  §2.3 prevents on the write side. An inactive pair has an empty interval and returns
  `points: []`.
- `range` echoes the **resolved** interval — the requested range intersected with what is
  stored — so a client can see how far coverage actually extends. An empty intersection —
  a range wholly outside stored history, or a pair with no rows — returns `range: null`
  with `points: []`.
- **The service reads 23 hours before `from`** so the first point has a complete 24-hour
  window. Without it, the first points of any range are silently wrong. When `from − 23h`
  reaches past `first_stored_hour`, the lookback truncates and the windows it cannot fill
  are `null` — §2.4's warm-up, surfacing mid-range instead of at the start of history. Both
  behaviours carry dedicated tests.
- **The lookback starts at the newest stored hour at or before `from − 23h`, not at
  `from − 23h`.** A pair can stay quiet for longer than the window, and `hour_start_unix >=
  from − 23h` then returns nothing before the requested range: the series starts inside it,
  and its first points come back as warm-up `null` when their windows are in fact full of
  quiet hours (§2.3). That anchor row is what makes those hours reconstructable, and the
  bug it prevents is invisible — the response is well-formed and the numbers are wrong.
  Pinned by `a gap spanning the lookback still fills the window`.
- **`from` and `to` are optional and both are inclusive**, floored to the hour they fall in:
  `to=…T23:59:59Z` keeps the hour that started at 23:00. An absent bound falls back to the
  pair's first or last stored hour, so a request with no query string asks for everything
  stored. `from > to` with both supplied is a `400`; a supplied bound outside stored history
  is an empty intersection, not an error.
- **The read path takes no transaction.** A request costs two statements — the pair's stored
  extent, then its rows — and ingest can commit between them. Rows are immutable and only
  ever appended forward (§2.3, §5.1), so the only reachable effect is that a request racing
  a write may not carry the newest hour, exactly as if it had arrived a moment earlier.
  Snapshot isolation would buy nothing a reader can observe.
- Persisted metrics are strings end to end; APR is the only numeric field.
- **In `/health`, a pair with no rows reports `lastHourStartUnix: null, ageSeconds: null`.**
  Null means nothing stored, not an error: the table cannot say *why* a pair is empty, and
  inventing an age — the seconds since 2022 — would read as a three-year outage. On this
  deployment the dead pair is null by design (§1); null on the active pair means ingest has
  never written it, which is the condition worth alarming on.
- **`/health` answers `503` once the database is unreachable** — `ok: false`, `db: false`,
  no pairs — so a monitor reading the status code alone never sees `200` while every read is
  failing. When it does answer `200`, `ageSeconds` counts from the *end* of the last stored
  hour, the reference the ingest guard measures from (§5.1), so the two cannot disagree
  about what stale means.

**Interpretation:** the brief asks for a service that, "based on a given pair address and a
date range, retrieves the metrics". We serve only the two configured pairs and answer `404`
for any other well-formed address, rather than ingesting on demand — the ingest process owns
what is collected, and a read path that could trigger collection would make coverage depend
on traffic.

Errors: malformed address, unparseable dates or `from > to` → `400`; well-formed but
unconfigured address → `404`; valid range with no data → `200` with an empty array, never a
`500`. A read that fails answers `503`, as `/health` does, and says only that the read
failed: the statements are fixed and parameterised, so every failure this path can reach is
the database being unavailable rather than a query being wrong.

Addresses are matched case-insensitively, so the EIP-55 form a block explorer hands out
resolves to the same pair as the lowercase one, and `pair.address` echoes back the stored
lowercase form either way.

### 6.2 All three windows are returned per point — decided

The moving-average selector is the exercise's one interactive control. Returning
`apr: { "1": …, "12": …, "24": … }` per point makes switching instant, with no refetch.

The cost is three numbers per point instead of one, against the nine fields each point
already carries — a small and *constant* fraction of the payload, whatever the range — plus
three windowed sums over an array already in memory. That holds at any size the API can be
asked for, which the alternative reasoning would not: the 48-hour figure bounds the initial
backfill, not what the API serves. A `window` parameter would make every toggle a round
trip to save that fraction. There is consequently no `window` parameter, and lookback is
always 23 hours.

---

## 7. Frontend

Vite + React + TypeScript SPA. Function components and hooks throughout; the brief prefers
hooks over classes "where possible", and nothing here needs a class. TanStack Query for
fetching, keyed on `(pair, from, to)`. Tailwind v4 with a CSS-first `@theme` built from
values extracted from the Figma; those values and the icon set ship with the package.

**The browser reaches the API through the Vite dev server's proxy**, which forwards `/api`
to the service on loopback. So the client carries no base URL, the API needs no CORS
configuration and no allowed-origin list, and the two processes stay one origin as far as
the browser is concerned. Rejected: `@fastify/cors`, which adds a config surface to a service
that has none, and serving the built SPA from Fastify, which would couple the API to a web
build and break §3's "nothing compiles across package boundaries". The cost is that a
deployed SPA needs a reverse proxy or CORS in front of it — a deployment concern rather than
a build one, and §10's.

**Three inconsistencies in the source are reproduced rather than normalised**, because the
brief asks for pixel fidelity and silently tidying a design is not our call. The Figma uses
three near-identical blues — `#2E71F0`, `#2467E8`, `#4A90E2` — where a system would use one,
and all three ship as separate tokens. The chart gridlines are stroked with radial gradients
whose transform makes every pixel the stop-0 colour, so the solid `#F5F7F8` and `#627086` in
the theme are exact reproductions rather than approximations. And the fifth Global Metrics
card reads `Total Depolyed` in the design, so it reads that way here: correcting a
misspelling silently is a deviation a reviewer holding the Figma cannot account for, and one
they would reasonably read as ours. `docs/design-tokens.md` §1.1 and §2.3 record how each
was measured.

**The sidebar's five destinations, the account button and the search field are chrome.** The
exercise is one page, so each carries an accessible name and Dashboard carries
`aria-current`, but none of them goes anywhere and the field has nothing to search. They are
reproduced because the design draws them. Rendering them dead rather than dropping them is
the opposite of the range-pill decision below, and for the same reason: a pill that is
disabled tells the reader something true about the data, whereas a missing sidebar would
just be an unfaithful reproduction of a frame the reviewer is holding.

```
components/layout      AppShell, Sidebar, TopBar
components/ui          Card, MetricCard, PillGroup, IconButton, SectionHeading
components/icons       13 glyphs exported from the Figma as inline SVG
features/metrics       GlobalMetrics, AnnualizedReturns   — hardcoded, as Sentora allows
features/performance   PerformanceCard, AprChart, ChartTooltip, toAprSeries, usePairMetrics
  chartStates/         ChartSkeleton, ChartError, ChartEmptyState
```

**Chart: Recharts.** The design is one line series with horizontal gridlines, hollow dots and
linear interpolation — nothing that needs hand-rolled SVG. Legend and controls are plain
DOM rather than chart primitives: the Figma fixes their spacing and type exactly, and that
is more direct to match in markup than through a library's layout props.
`connectNulls={false}`, so nulls render as a shorter line rather than an invented one.
Leading and trailing warm-up nulls are trimmed from the plotted series instead: a request
with no bounds starts at `first_stored_hour`, where the first N−1 hours can never fill their
window (§2.4), and drawing them would spend a fifth of the plot on empty axis. Nulls inside
the series stay gaps, because a hole there is a fact about the data rather than an artefact
of where the range begins. The chart fills the height its container gives it, so the plot
area is sized in one place.

**Three selectors, one `PillGroup`, one control row:** date range, moving-average window
(1/12/24h), and pair. The Figma has only the range row; the other two reuse its styling in
the same row, whose right half is empty in the design. **The pair selector is our addition**
— the Figma selects no pairs — and it is not optional: with the empty series an explicitly
evaluated behaviour (§1), the selector is the only way a reviewer reaches it in the UI.
Switching the moving-average window never refetches (§6.2).

**Range options the data cannot support are rendered disabled, not hidden or adaptive.** The
design offers `7d / 1m / 3m / 6m / 1y / YTD / Custom / All`; a 48-hour backfill supports the
last two. Which options are supported is a function of how long ingest has been running, so
that split is correct for a fresh deployment and starts going stale after a week. All eight
render, to match the design; the rest carry reduced opacity, `cursor: not-allowed`, and a
title saying they need more history. A control that leads nowhere is worse than one visibly
unavailable — disabled reads as a data constraint, silently empty reads as a bug. Deriving
availability from stored extent is §10.

**Responsive.** The Figma defines a single 1440px frame, so every breakpoint is ours: metric
grids collapse 5/4 → 2 → 1 at `xl` and `sm`, the sidebar hides below `md`, the control row
wraps, and the
chart keeps a fixed height with fluid width, insetting its series 30px from each end of the
x axis so the first and last points are not flush against the plot edge. Page padding is 42px against the 63px sidebar,
putting content at x=105 with the section titles and the header title rather than at the
design's x=104 — a 1px inconsistency in a hand-placed frame, and alignment is worth more
than reproducing it. Below `md` it drops to 16px, the design's own card padding rather than
a new value, because a desktop inset spends a quarter of a phone screen on margin.

The five-across row needs `xl` rather than `md`: five 206px cards and their four 10px gaps
are 1070px of content, and a 768px viewport has 621px once the sidebar and padding are
taken. At `xl` the grid tracks are the design's fixed 206px, so the row packs left and
leaves the whitespace to its right that the frame draws; below that the tracks divide the
width evenly and the cards fill them, which is what makes the one- and two-across layouts
usable on a phone.

**The header and the sidebar both stick to the viewport**, at every width. The sidebar is
`100dvh` rather than stretching to the content, so its bottom group — notifications and the
account button — stays where the design puts it instead of drifting down as the page grows.
Nothing in the chrome is worth scrolling past to reach: below `md` the header carries the
only navigation on screen and the collapsed search trigger, and above it the two together
are the whole frame the content sits in.

Below `md` the header's search field collapses to its icon and expands back over the whole
bar when tapped, with a dismiss control returning it to the icon. Side by side, the 351px
field and the title do not fit; the alternative, shrinking the field, leaves two cramped
things instead of one whole one. The dismiss glyph is ours, since a design with no collapsed
state has nothing to dismiss.

**States the design does not define** — loading, error, empty — occupy the plot area at its
fixed height, so switching pairs causes no layout shift. Loading is a block filling that area
with a spinner in it rather than a centred line of text: the block occupies the box the chart
will occupy, so the arriving series replaces it in place instead of the page appearing to
jump. The card keeps its full chrome in
all three: header, legend and every selector stay interactive, so returning from the empty
pair needs no reload. The empty state is designed rather than generic — it names what is
absent and why, since a pair with no rows is a real state of this system, not a failure.

**There are two empty states, not one**, and they are told apart because they mean different
things. A pair with no stored rows has never traded in the window we collect — the dead
pair's steady state (§1). A pair whose every stored hour still falls inside the first N−1 of
its window has data and simply cannot be averaged yet (§2.4). Both draw an empty plot, so
only the copy separates them, and the second is the one that reads as breakage: it looks
identical to a service that returned nothing. Pinned by `empty state renders` and
`names warm-up apart from a pair with no rows`.

---

## 8. Edge cases and failure handling

Each handling claim is backed by a named test, which arrives in the commit that adds the
behaviour.

| Failure | Handling | Test |
|---|---|---|
| Pair with no data in the window (WETH/RKFL) | Ingest writes nothing, exits 0; API returns `points: []`; UI shows an empty state | `empty pair → zero writes, exit 0` · `no data → 200 []` · `empty state renders` |
| Hours with no activity produce no entity | Time-based windows, gaps reconstructed (§2.3) | `apr over gapped series` |
| `reserveUSD = 0` | APR `null`: return on zero capital is undefined, not infinite (and JSON could not carry `Infinity`/`NaN` anyway) | `zero liquidity → null` |
| Incomplete window at the start of history | `null`; counts 0/11/23 for N = 1/12/24 | `warm-up null counts` |
| Range starts before enough history exists | 23 hours of lookback before `from`; truncated at `first_stored_hour`, unfillable windows `null` (§2.4) | `lookback window` · `lookback truncated at start of history → nulls` |
| Range extends past the last ingested hour, so un-ingested hours would be imputed as zero | Reconstruction bounded to `[first_stored, last_stored]`; hours outside are omitted and `range` echoes the resolved interval (§6.1) | `range past last stored hour omits trailing hours, does not impute` |
| Range wholly outside stored history (asking for January 2024) | Empty intersection: `200` with `range: null`, `points: []` — the same shape the inactive pair returns (§6.1) | `disjoint range → 200, null range, empty points` |
| Indexer behind chain head, so a wall-clock-complete hour is half-indexed | "Now" bounded by `_meta.block.timestamp` (§5.2); lag over 10 min warns, which is below the 15-minute margin and so an early warning rather than a report of damage | `lagging indexer bounds upper hour` |
| `_meta` query fails | The classifier retries it like any request; if it still fails the run aborts writing nothing — no wall-clock fallback (§5.2) | `missing _meta aborts the run, writes nothing` |
| Indexer reports `hasIndexingErrors: true` | Logged as a warning, ingest proceeds — the flag is subgraph-wide, with no per-pair or per-hour resolution to act on | `hasIndexingErrors → warning, run proceeds` |
| Downtime leaves a hole the API would fill with fabricated zeros | Contiguity invariant (§2.3) | `resume after gap backfills every missing hour` |
| Gap holding more than 1,000 rows (~41 days if every hour traded) outgrows one page — a bound on one fetch, distinct from the uncapped catch-up above | Explicit `first`, ascending order, so a truncated fetch is a contiguous prefix and the next run resumes; not paginated by decision (§9) | `truncated fetch leaves a contiguous series` |
| Crash mid-catch-up | The pair's transaction commits nothing; the next run recomputes its bounds from the table and converges | `crash mid-catch-up commits nothing, rerun converges` |
| Gateway failures: transport, 429, 5xx, and GraphQL errors inside HTTP 200 | Classified retry — transport/429/5xx retried with backoff; body `errors` and zod failures fail fast; one transaction per pair; non-zero exit | `classifier cases` · `mid-run failure → no partial writes` · `one pair failing leaves the other committed` |
| Invalid requests: `from > to`, malformed address, unknown pair, empty range | 400 / 400 / 404 / `200 []` — never a 500 | `validation and empty-range suite` |
| API unreachable, erroring, or slow under the UI | Loading and error states occupy the plot area at its fixed height (§7); card chrome stays interactive, so recovery needs no reload | `loading state while pending` · `error state renders on failed fetch` |

**Eliminated by construction** — each holds for as long as the invariant beside it does,
and each invariant is pinned by a test rather than asserted:

- **Partial-hour distortion**: completed hours only, staleness measured from hour end
  (§5.1). Pinned by `no stored row reaches the in-progress hour`.
- **Concurrent-run races**: immutable rows and `ON CONFLICT DO NOTHING` make interleaved
  runs harmless. Pinned by `two concurrent runs produce the same table as one`.
- **Interrupted-run inconsistency**: one transaction per pair, immutable rows, and a cursor
  derived from the data rather than stored beside it. Pinned by the table's own crash row,
  `crash mid-catch-up commits nothing, rerun converges`.

**Known limitations:**

- Tracked volume can understate exotic pairs (§2.1); accurate for USDC/WETH.
- Gateway quota is not monitored.
- Requests-per-second limits are distinct from the 1,000-row page cap and the unmonitored
  quota, and nothing is built for them: a run makes two or three requests in total — one
  `_meta`, one per pair with anything to fetch — so no plausible per-second limit binds. If
  the gateway throttled anyway, the 429 is retried with backoff like any transient failure.
- `/health` cannot tell a dead ingest from a lagging indexer: either way
  `MAX(hour_start_unix)` freezes and `ageSeconds` climbs. The disambiguation is in the
  ingest logs, which record indexer lag on every run (§5.2). Surfacing lag in `/health`
  would need the API to query the gateway or ingest to persist run-state — a second
  upstream for the read path, or the cursor table §5.3 rejects. The log line is the
  diagnostic.
- Pair symbols are constants verified once, not re-checked at runtime.
- Rows are never updated, so a subgraph reindex that corrects a value we already stored does
  not propagate. Accepted in exchange for immutability (§5.1); a corrective re-ingest would
  need the rows deleted first — and deleted as a *suffix*, everything from some hour
  onward. The lower bound is `MAX(hour_start_unix) + 1h`, so it only ever moves forward: a
  hole punched in the middle of the series is never revisited, and the API would then serve
  it as a quiet hour. Ingest cannot produce such a hole itself, since a run writes one
  transaction per pair and always resumes from the newest stored hour.
- The API range is uncapped, and the stored series grows by at most 24 rows per pair per day
  for as long as ingest runs. Response size follows the range, not the row count, since quiet
  hours are reconstructed: 24 points per day requested, so roughly 720 after a month and
  8,760 after a year. That is bounded by retention, not by anything the API enforces.
  Acceptable at the scale this is delivered at, but it is a real bound once the service has
  been running, not a hypothetical one.

---

## 9. Considered and rejected

**Window-averaged liquidity in the denominator.** Arguably more accurate over volatile
ranges. Rejected: point-in-time matches convention, is easier to explain, and the two are
numerically indistinguishable on this data (§2.2).

**Storing the partial current hour with an `is_partial` flag.** Rejected: rows become
mutable, the newest point understates APR for up to an hour, and the flag leaks into the API
and the UI. Ingesting only completed hours makes the case disappear (§5.1).

**Computing APR in SQL with window functions.** Rejected: a SQL window frame counts rows,
not hours, so every gap needs generated scaffold rows before the window can see it; and a
pure function in `shared` tests against hand-computed fixtures with no database in the loop
(§3).

**A decimal library.** Rejected per the precision rule (§3): arithmetic is on USD values
below 10⁸, where doubles have headroom. If a hand-computed fixture ever disagreed in
the last digit, `big.js` is the narrow answer.

**Paginating the fetch, with batched writes.** Only catch-up grows, and at most one row per
hour, so the ceiling is the page limit of **1,000 rows** (`first: 1000` returned exactly
that in testing) — ~41 days of downtime for a pair trading every hour, more calendar time
for a quieter one. Rejected as complexity for a scenario this system will not meet.
Instead: an explicit `first` and ascending order, so an exceeded limit returns a contiguous
prefix and the next run resumes from the advanced `MAX(hour_start_unix)`. If the window
grew to weeks, the technique is cursor pagination on `hourStartUnix_gt` with a batched
upsert per page — the same cursor mechanism the ingest already uses between runs.

**Ingesting at the indexer head, with no finality margin.** Simpler, and the chart's newest
point would be 15 minutes fresher. Rejected: rows are immutable (§5.1), so an hour built
from blocks that later reorg stays wrong with no correction path, and the damage scales
inversely with pool size — negligible on USDC/WETH, a quarter of a small pool. The cost of
the margin is bounded and invisible at hourly granularity: the newest point appears 15
minutes after its hour closes instead of seconds after, and the guard still fires once an
hour, just shifted inside the cycle. Public dashboards do follow the head, but they can
correct a number afterwards and we cannot.

**`pg_advisory_lock` around runs.** Rejected as redundant: with immutable rows and
`ON CONFLICT DO NOTHING`, concurrent runs cannot corrupt anything — a claim pinned by §8's
`two concurrent runs produce the same table as one`, not just asserted.

**A `pairs` table and `/pairs` endpoint.** Rejected: the exercise fixes two addresses, so
the only consumers were two labels we already know. Symbols live in `shared` where adding a
pair is a one-line change. Justified if pairs became dynamic or user-configurable, which the
exercise does not ask for.

**A flag marking a pair as empty, to skip its query.** Any reviewer wonders why we query a
pair dead since 2022 on every run. Rejected: the flag is run-state of exactly the kind §5.3
avoids, and it needs a mechanism to clear itself or a revived pair never recovers. One
request per run returning an empty array is not a cost worth mutable state. With dozens of
inactive pairs the answer would be a recorded last-attempt with backoff, not a boolean.

**A `window` query parameter.** Rejected in favour of returning all three windows (§6.2).

**A chart-shaped response.** Returning only `hourStartUnix`, `apr`, the USD figures and
`imputed` would drop four strings per point. Rejected: the brief asks for a service that
retrieves the metrics, not an endpoint shaped to one client (§6.1), and the coin-denominated
amounts are the reading its introduction gives volume and liquidity (§4).

**A logging library (pino, winston).** Rejected: the process emits a handful of structured
lines per run, and tests assert on an injected sink by value rather than by capturing
output, so a library would contribute formatting, levels and transports none of which are
used. `JSON.stringify` to stdout, errors to stderr, is the whole requirement — a few lines,
against the same reasoning §5.4 uses to keep the retry loop hand-written. Worth revisiting
the moment log volume, sampling or rotation becomes a question.

**A client state library (Zustand, Jotai, Redux).** UI state is three values — pair, range,
moving-average window — all local to the Performance card. Server state belongs to TanStack
Query. Nothing is shared across the tree, so a store would be indirection with no consumer.

**API-side caching (Redis, in-memory).** The query is a range scan on the primary key, so it
costs what the requested range costs and nothing more — there is no latency to remove, and a
cache would add invalidation plus a second way to serve stale data. The right layer for
immutable hourly rows is HTTP: `Cache-Control` with a `max-age` running to the next hour
boundary *plus the ingest margin* lets browsers and any CDN cache it with no invalidation
logic. Cheap to add if time allows; the margin matters, since expiring exactly on the
boundary refreshes just before the new hour is written.

**SSR/ISR with Next.js.** Better than it first looks: the parameter space is small enough to
enumerate, and the data changes on a known cadence, once an hour (§5.1). Rejected because
that cadence does not yield an exact `revalidate` — ISR's clock is anchored to page
generation, not to the hour boundary, so a page built mid-hour can serve data missing the
newest hour for close to an hour. Exactness would need ingest triggering on-demand
revalidation, coupling it to the web service against §5. With no latency to remove either
(see the caching entry above), the hourly cadence is spent on `Cache-Control` instead. Worth
revisiting for shareable per-range URLs or public indexable pages.

**A document store (MongoDB).** One flat record type with no joins superficially favours
documents. Rejected on the two counts that decide it: the case for documents is schema
*variability*, and this schema is fixed and known; and arbitrary-precision numerics are the
default in Postgres (`NUMERIC`) but opt-in in BSON (`Decimal128`), risking the one
guarantee this system cannot lose.

---

## 10. With more time

- **Verify `feeTo` on-chain.** §2.1's 0.30% is a hypothesis precisely because there is no
  RPC here. One `eth_call` to the factory would turn the most load-bearing constant in the
  whole calculation from assumed into verified.
- **Test reconstruction against a real gapped series.** USDC/WETH shows no gap in 1,000
  verified hours, so gap handling is exercised only by synthetic fixtures (§2.3). With more
  time: find a moderately active pair with genuine quiet hours and assert reconstruction
  against what the subgraph actually returns.
- **Backfill beyond 48 hours.** A longer history would make the wider range selectors
  meaningful and give the 24-hour average a fuller warm-up. Nothing structural changes: the
  fetch already takes any interval (§5.5), and the lower bound is the only constant involved.
- **Range options derived from stored coverage.** Expose `MIN`/`MAX(hour_start_unix)`
  alongside the metrics — a `/coverage` route or a response field, neither exists today —
  and enable each option once that pair's history covers it, so `7d` appears on the seventh
  day. Per pair, not global. Not built now: with 48 hours of history the derivation yields
  the same two options every run, so the behaviour would never be observable — but §7's
  hardcoded split starts going stale after a week of ingest running.
- **Design the states the Figma leaves undefined.** Loading, error and empty are invented
  within the design's idiom, and every breakpoint is ours because the Figma fixes a single
  1440px frame (§7). With more time these would be designed, not extrapolated.
- **Frontend test coverage.** Two of §8's sixteen rows touch the UI. The imbalance is real:
  component tests for the selectors, the tooltip and the pill states would be the next
  tests written.
- **API hardening.** The API has no authentication and no rate limiting of its own —
  acceptable for a service that is not internet-facing, both required before it were.
- **Data retention.** The table grows without bound; a real deployment would want a
  retention policy or rollups.
- **Metrics instead of logs** for indexer lag and gateway quota, so freshness is observable
  rather than discoverable.
- **An end-to-end smoke test** across ingest → API → chart.
