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

## Before calling something done

Walk the path of whoever will use it, from a clean state rather than from yours.

- **Wrote a function?** Name its caller. If there isn't one yet, say so — an exported
  helper with no call site is a guard someone can forget.
- **Wrote a command or a script?** Run it with the database down, the container stopped,
  the env unset. Green on your warmed-up machine proves nothing about a fresh clone.
- **Wrote a test helper?** Say what the database, the filesystem and the environment look
  like after it has run.
- **Added a requirement?** Put it in the package that has it, not the one you happened to
  be editing.

Every mistake worth a correction here so far has been the same one: a piece written
correctly in isolation, with the path around it never walked.

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

## Code style

Biome enforces what it can (`pnpm check`). These are the conventions it doesn't cover:

- **Blank line before a `return` that follows other statements.** One-line functions need
  no separation.
- **Comments carry what the code can't.** Before writing one, ask what a reader loses
  without it. Preconditions that can't be checked at runtime, decisions with a rejected
  alternative, and non-obvious reasons earn their place. These do not: restating the
  signature, repeating a DESIGN.md section instead of citing it, explaining a well-named
  constant, or narrating control flow.
- **Cite, don't duplicate.** DESIGN.md is the source of truth. A comment points at
  `(§2.2)`; it never reproduces the formula, the rationale, or the trade-off, because then
  a change to the document has two places to land and they drift.
- **Length isn't the criterion.** A long comment explaining why CI runs typecheck from the
  first workflow commit earns its place; `// increment counter` doesn't. Judge by what's
  lost without it.
- **Small functions, readable over defensive.** No speculative generality, no error
  handling for conditions that can't occur here.
- **Don't hand-format.** Run `pnpm check` before finishing. If Biome and this file
  disagree, Biome wins — tell me so I fix the config.

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

All from the repo root. Nothing needs a database started by hand — the commands that need
one bring it up.

```
pnpm db:up          # Postgres 17 on localhost:5432
pnpm db:down
pnpm db:migrate     # db:generate after editing schema.ts
pnpm ingest         # one ingest run
pnpm test           # starts and migrates the database, then runs packages one at a time
pnpm check          # Biome: lint and format
pnpm typecheck

```

Run instructions for the services land with the packages that introduce them.
