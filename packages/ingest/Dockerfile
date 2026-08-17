# No build stage: Node 24 runs the TypeScript directly (§3).
FROM node:24-alpine

RUN corepack enable

WORKDIR /app

# Manifests first, so a source change does not re-resolve the dependency graph.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY packages/ingest/package.json packages/ingest/

# `...` adds the workspace dependencies of ingest, nothing more. `--prod` drops the
# toolchain: nothing here builds, lints or tests, so biome, vitest, typescript and
# drizzle-kit would be 160 MB of image that never runs.
RUN pnpm install --frozen-lockfile --prod --filter @uniswap-v2-pair-metrics/ingest...

COPY packages/shared packages/shared
COPY packages/ingest packages/ingest

USER node
WORKDIR /app/packages/ingest

CMD ["node", "src/main.ts"]
