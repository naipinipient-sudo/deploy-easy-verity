/**
 * Postgrest/Auth errors carry code/details/hint beyond `.message` -- always
 * log the raw object (hint especially: Postgres often puts the actual fix
 * there, e.g. a GRANT statement for 42501) and surface as much as we can
 * in the message shown to the user, instead of a generic fallback that
 * throws away the one clue that would explain the failure.
 */
export function describeError(error: unknown, fallback: string): string {
  console.error(error);
  if (error && typeof error === "object") {
    const e = error as { message?: string; hint?: string; code?: string };
    if (e.message) return e.hint ? `${e.message} (${e.hint})` : e.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
