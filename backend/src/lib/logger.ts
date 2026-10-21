// Minimal structured logger (English). Silent in tests unless LOG_IN_TESTS=1.
//
// Everything written goes through `redact` first: customer phone numbers are masked, and
// addresses, passwords, tokens, keys and connection strings never reach the logs, whatever a
// caller (or an error message from a library) contains.

const silent = process.env.NODE_ENV === "test" && process.env.LOG_IN_TESTS !== "1";

type Fields = Record<string, unknown>;

const REDACTED = "[redacted]";
/** Field names whose value is never written. */
const SECRET_KEY =
  /pass(word|phrase)?(hash)?$|secret|tokens?$|api[-_]?key|authorization|cookie|credential|signature|^(mongodb_?)?uri$|address|adresse|^link$/i;
const PHONE_KEY = /phone|t[ée]l[ée]phone/i;

/** "0555123456" → "05••••••56" (enough to tell numbers apart, not to call them). */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length < 6 ? "••••" : `${digits.slice(0, 2)}••••••${digits.slice(-2)}`;
}

/** Secrets and phone numbers inside free text (error messages, URLs). */
export function redactText(text: string): string {
  return (
    text
      // Connection strings with credentials: mongodb+srv://user:pass@host → mongodb+srv://[redacted]@host
      .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${REDACTED}@`)
      // Tokens and keys in URLs or "key=value" text.
      .replace(
        /\b(access_token|api_key|apikey|token|secret|password|signature|jeton)=[^\s&"']+/gi,
        `$1=${REDACTED}`,
      )
      .replace(/#jeton=[^\s"']+/g, `#jeton=${REDACTED}`)
      .replace(/\bBearer\s+[\w.~+/-]+=*/gi, `Bearer ${REDACTED}`)
      // Brevo keys, Meta tokens.
      .replace(/\bxkeysib-[\w-]+/g, REDACTED)
      .replace(/\bEAA[A-Za-z0-9]{20,}/g, REDACTED)
      // Algerian phone numbers, any writing (0555 12 34 56, +213555123456…).
      .replace(/(?:\+|00)?(?:213|\b0)[\s.-]?[567](?:[\s.-]?\d){8}\b/g, (phone) => maskPhone(phone))
  );
}

/** A copy of the fields that is safe to write. */
export function redact(value: unknown, key = "", depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (key && SECRET_KEY.test(key)) return REDACTED;
  if (typeof value === "string") {
    return key && PHONE_KEY.test(key) ? maskPhone(value) : redactText(value);
  }
  if (depth > 5 || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, key, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([name, child]) => [name, redact(child, name, depth + 1)]),
  );
}

function write(level: "info" | "warn" | "error", message: string, fields?: Fields) {
  if (silent) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${redactText(message)}`;
  const extra = fields && Object.keys(fields).length ? redact(fields) : undefined;
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
