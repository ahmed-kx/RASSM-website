// Minimal structured logger (English). Silent in tests unless LOG_IN_TESTS=1.

const silent = process.env.NODE_ENV === "test" && process.env.LOG_IN_TESTS !== "1";

type Fields = Record<string, unknown>;

function write(level: "info" | "warn" | "error", message: string, fields?: Fields) {
  if (silent) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
  const extra = fields && Object.keys(fields).length ? fields : undefined;
  if (level === "error") console.error(line, ...(extra ? [extra] : []));
  else if (level === "warn") console.warn(line, ...(extra ? [extra] : []));
  // eslint-disable-next-line no-console -- the server's normal output
  else console.log(line, ...(extra ? [extra] : []));
}

export const logger = {
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};

/** Error details for the logs only (never sent to clients). */
export function describeError(error: unknown): Fields {
  if (error instanceof Error)
    return { error: error.name, message: error.message, stack: error.stack };
  return { error: String(error) };
}
