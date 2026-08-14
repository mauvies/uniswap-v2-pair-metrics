import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./src/database-url.ts";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: databaseUrl(process.env) },
});
