import { defineConfig } from "drizzle-kit";

// Same env vars and defaults as docker-compose.yaml — an exported POSTGRES_PORT reaches
// both. The defaults are duplicated by hand; keep them in sync.
const {
  POSTGRES_USER = "uniswap",
  POSTGRES_PASSWORD = "uniswap",
  POSTGRES_DB = "uniswap_v2_pair_metrics",
  POSTGRES_PORT = "5432",
  DATABASE_URL = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}`,
} = process.env;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: DATABASE_URL },
});
