import { databaseUrl } from "@uniswap-v2-pair-metrics/shared";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("127.0.0.1"),
});

export interface Config {
  databaseUrl: string;
  port: number;
  host: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.parse({
    DATABASE_URL: databaseUrl(env),
    PORT: env.PORT,
    HOST: env.HOST,
  });

  return { databaseUrl: parsed.DATABASE_URL, port: parsed.PORT, host: parsed.HOST };
}
