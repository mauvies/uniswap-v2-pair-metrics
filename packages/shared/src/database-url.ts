const DEFAULTS = {
  user: "uniswap",
  password: "uniswap",
  db: "uniswap_v2_pair_metrics",
  port: "5432",
} as const;

/**
 * The connection string for a host-side process — migrations, ingest, the API.
 *
 * `DATABASE_URL` wins; otherwise it is assembled from the same `POSTGRES_*` variables
 * `docker-compose.yaml` reads, with the same defaults, so exporting `POSTGRES_PORT` to
 * dodge a Postgres already on 5432 reaches every one of them.
 *
 * Compose keeps its own copy of these defaults and cannot import this: it configures the
 * server itself, and the URL it hands the ingest container uses the compose network host
 * `db` rather than localhost. That one is a genuinely different string, not a third copy.
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
