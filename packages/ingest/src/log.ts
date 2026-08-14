export type LogLine = { level: "info" | "warn" | "error"; event: string } & Record<string, unknown>;

export type Log = (line: LogLine) => void;

/**
 * One JSON object per line. Errors go to stderr so a scheduler that mails them does not
 * also mail the healthy runs.
 *
 * Never pass the gateway URL: the API key is a path segment of it. `config.ts` carries
 * the same warning where the URL is built — two places to get it wrong, so two reminders.
 */
export const log: Log = (line) => {
  const serialised = JSON.stringify(line);

  if (line.level === "error") {
    process.stderr.write(`${serialised}\n`);

    return;
  }

  process.stdout.write(`${serialised}\n`);
};
