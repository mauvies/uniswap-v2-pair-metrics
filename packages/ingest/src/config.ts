import { databaseUrl } from "@uniswap-v2-pair-metrics/shared";
import { z } from "zod";

const SUBGRAPH_ID = "A3Np3RQbaBA6oKJgiwDJeo5T3zrYfGHPWFYayMwtNDum";
const MISSING_API_KEY = "THEGRAPH_API_KEY is not set — copy .env.example to .env and set it";

const schema = z.object({
  THEGRAPH_API_KEY: z.string({ error: MISSING_API_KEY }).min(1, MISSING_API_KEY),
  DATABASE_URL: z.url(),
});

export interface Config {
  gatewayUrl: string;
  databaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse({
    THEGRAPH_API_KEY: env.THEGRAPH_API_KEY,
    DATABASE_URL: databaseUrl(env),
  });

  if (!result.success) {
    throw new Error(z.prettifyError(result.error));
  }

  const parsed = result.data;

  return {
    // The API key is a path segment of this URL. Never log the URL itself.
    gatewayUrl: `https://gateway.thegraph.com/api/${parsed.THEGRAPH_API_KEY}/subgraphs/id/${SUBGRAPH_ID}`,
    databaseUrl: parsed.DATABASE_URL,
  };
}
