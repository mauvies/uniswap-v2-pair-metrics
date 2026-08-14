import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./src/db/database-url.ts";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dbCredentials: { url: databaseUrl(process.env) },
});
