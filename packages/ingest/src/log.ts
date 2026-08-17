export type LogLine = { level: "info" | "warn" | "error"; event: string } & Record<string, unknown>;

export type Log = (line: LogLine) => void;

/**
 * One JSON object per line. Errors go to stderr, so a scheduler that mails stderr does not
 * mail the healthy runs too.
 */
export const log: Log = (line) => {
  const serialised = JSON.stringify(line);

  if (line.level === "error") {
    process.stderr.write(`${serialised}\n`);

    return;
  }

  process.stdout.write(`${serialised}\n`);
};
