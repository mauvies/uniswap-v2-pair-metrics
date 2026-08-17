const DEFAULTS = {
  user: "uniswap",
  password: "uniswap",
  db: "uniswap_v2_pair_metrics",
  port: "5432",
} as const;

/**
 * Connection string for host-side processes (migrations, ingest, API).
 *
 * `DATABASE_URL` takes precedence. If unset, it is assembled from the same `POSTGRES_*`
 * variables and defaults as `docker-compose.yaml`. This allows exporting `POSTGRES_PORT`
 * to avoid collisions with a local Postgres instance on 5432.
 *
 * Docker Compose maintains its own copy of these defaults to configure the DB container.
 * The URL supplied to the containerized ingest points to the Compose host `db` rather
 * than `localhost`.
 */
export function databaseUrl(env: Record<string, string | undefined>): string {
  if (env.DATABASE_URL !== undefined && env.DATABASE_URL !== "") {
    return env.DATABASE_URL;
  }

  const user = env.POSTGRES_USER ?? DEFAULTS.user;
  const password = env.POSTGRES_PASSWORD ?? DEFAULTS.password;
  const port = env.POSTGRES_PORT ?? DEFAULTS.port;
  const database = env.POSTGRES_DB ?? DEFAULTS.db;

  return `postgres://${user}:${password}@localhost:${port}/${database}`;
}
