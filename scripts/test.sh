#!/bin/sh
set -e

TEST_DATABASE=$(node --input-type=module -e \
  'process.stdout.write((await import("./packages/shared/src/db/support.test-helpers.ts")).TEST_DATABASE)')

pnpm db:up

docker compose exec -T db \
  psql -v ON_ERROR_STOP=1 -v dbname="$TEST_DATABASE" -U "${POSTGRES_USER:-uniswap}" -d postgres <<'SQL'
SELECT format('CREATE DATABASE %I', :'dbname')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'dbname')
\gexec
SQL

export POSTGRES_DB="$TEST_DATABASE"

pnpm --filter @uniswap-v2-pair-metrics/shared db:migrate

pnpm -r --if-present --workspace-concurrency=1 test
