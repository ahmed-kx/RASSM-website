/**
 * Server errors ({ field: "French message" }) in the shape of the forms' Zod validator, for
 * `form.setErrorMap({ onDynamic: errors })`: each message appears under its field like a
 * client-side error and is replaced at the next validation (next change). Only fields the
 * form knows are kept; the others are returned in `unknownMessages` to show elsewhere.
 */
export function toServerErrors(
  fields: Record<string, string>,
  knownFields: readonly string[],
): { errors: { fields: Record<string, { message: string }[]> }; unknownMessages: string[] } {
  const known: Record<string, { message: string }[]> = {};
  const unknownMessages: string[] = [];
  for (const [name, message] of Object.entries(fields)) {
    if (knownFields.includes(name)) known[name] = [{ message }];
    else unknownMessages.push(message);
  }
  return { errors: { fields: known }, unknownMessages };
}
