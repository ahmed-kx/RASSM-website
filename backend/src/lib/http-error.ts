import type { ApiErrorBody } from "@rassm/shared";
import type { z } from "zod";

/**
 * An error the client may see: HTTP status, French message and, for forms, a French
 * message per field. Anything else thrown in a route becomes a generic 500.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }

  toBody(): ApiErrorBody {
    return { error: { message: this.message, ...(this.fields && { fields: this.fields }) } };
  }
}

export const INVALID_FORM_MESSAGE =
  "Certains champs sont invalides : vérifiez les messages indiqués.";

/**
 * First French message per field from Zod issues. `stripPrefix` removes a wrapper key
 * from the path (e.g. "order" in { order: {...} }), so names match the form fields.
 */
export function issuesToFields(
  issues: readonly z.core.$ZodIssue[],
  stripPrefix?: string,
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.map(String);
    if (stripPrefix && path[0] === stripPrefix) path.shift();
    const key = path.join(".") || "_form";
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Parses `input` or throws a 400 with the French message of each invalid field. */
export function parseOrThrow<T extends z.ZodType>(
  schema: T,
  input: unknown,
  stripPrefix?: string,
): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields = issuesToFields(result.error.issues, stripPrefix);
  const keys = Object.keys(fields);
  const message = keys.length === 1 && fields._form ? fields._form : INVALID_FORM_MESSAGE;
  throw new HttpError(400, message, fields);
}
