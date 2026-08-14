import { databaseUrl } from "@uniswap-v2-pair-metrics/shared";
import { z } from "zod";

const SUBGRAPH_ID = "A3Np3RQbaBA6oKJgiwDJeo5T3zrYfGHPWFYayMwtNDum";

const schema = z.object({
  THEGRAPH_API_KEY: z.string().min(1, "a The Graph gateway API key is required"),
  DATABASE_URL: z.url(),
});

export interface Config {
  gatewayUrl: string;
  databaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.parse({
    THEGRAPH_API_KEY: env.THEGRAPH_API_KEY,
    DATABASE_URL: databaseUrl(env),
  });

  return {
    gatewayUrl: `https://gateway.thegraph.com/api/${parsed.THEGRAPH_API_KEY}/subgraphs/id/${SUBGRAPH_ID}`,
    databaseUrl: parsed.DATABASE_URL,
  };
}
