# CLAUDE.md

## Read first

`docs/DESIGN.md` is the source of truth for every decision — hypotheses, data model, API
contract, failure handling, and what was considered and rejected. Read it before proposing
anything that contradicts it. If you think a decision is wrong, say so explicitly instead of
working around it.

## Working rule

One unit of work per turn: implement one commit's worth, stop, wait for review. I review
the diff, run the tests, and commit — you never commit. Don't batch, even if a change feels
small enough to fold in.

Conventional Commits. Every commit compiles and passes `pnpm check` and `pnpm typecheck`, and
`pnpm test` once tests exist. The history is clean from the first commit, not salvaged by a
rebase later.

## Objecting to a decision

You have standing authority — an obligation, really — to challenge anything in DESIGN.md or
in my instructions. A useful objection names four things: the decision, what is wrong with
it (verified where possible), what to do instead, and what the change costs. If you cannot
fill all four, it is a note, not an objection.

## Non-negotiables

- Every "handled" row in DESIGN.md §8 needs a test with the name given there, and so does
  each pin under "eliminated by construction".
- No floats on the persistence path: subgraph strings → `NUMERIC` → strings out.
  `Number()` is called in exactly one place, inside the APR function (§3).
- Migrations via `drizzle-kit generate` + `migrate`, never `push`. Commit the `.sql`.
- Secrets through validated env config only. Never inline a key, never commit `.env*`.
- Configuration lands with the code that needs it — no config entry, script or documented
  command for something not yet in the repo.

## Docs

Plain, direct English: one idea per sentence, lead with the point, concrete subject and
active verb. Keep every number, term and identifier exact — the precision is not what makes
prose hard to read. Wrap at ~90 columns to match the surrounding paragraphs. Every line earns
its place.

Every figure in DESIGN.md is either a dated measurement or derived from a stated bound. A
number that is true on day one and false after a week of running is a bug in the document.

## Stack

pnpm workspaces · TypeScript · Biome · Postgres + Drizzle · Fastify · Vite + React +
Tailwind v4 · Vitest.

No build orchestrator (§3), no GraphQL client, no retry library (§5.4). §9 lists what else
was rejected and why — read it before adding a dependency.

## Commands

```
pnpm check       # Biome: lint and format
pnpm typecheck
pnpm test
pnpm build
```

Run instructions for the services land with the packages that introduce them.
