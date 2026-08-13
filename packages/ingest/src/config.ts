import { z } from "zod";

const SUBGRAPH_ID = "A3Np3RQbaBA6oKJgiwDJeo5T3zrYfGHPWFYayMwtNDum";

const schema = z.object({
  THEGRAPH_API_KEY: z.string().min(1, "a The Graph gateway API key is required"),
});

export interface Config {
  gatewayUrl: string;
}

/**
 * Throws at startup naming the variable that is missing. Nothing below this reads
 * `process.env`.
 *
 * The key is a path segment of `gatewayUrl`, so that string must never be logged or
 * attached to an error — `GatewayFailure` carries a status and a message, never the URL.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.parse(env);

  return {
    gatewayUrl: `https://gateway.thegraph.com/api/${parsed.THEGRAPH_API_KEY}/subgraphs/id/${SUBGRAPH_ID}`,
  };
}
