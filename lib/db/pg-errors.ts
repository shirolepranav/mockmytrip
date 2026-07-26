/**
 * Postgres unique-violation (23505) detection. Drivers/ORMs sometimes wrap
 * the underlying pg error in an outer Error (e.g. a query-failed wrapper
 * with the real error as `.cause`), so this checks both the error itself
 * and one level of `.cause`.
 */
export function isUniqueViolation(error: unknown): boolean {
  const codeOf = (value: unknown): unknown =>
    typeof value === "object" && value !== null && "code" in value
      ? (value as { code?: unknown }).code
      : undefined;
  if (codeOf(error) === "23505") return true;
  const cause = error instanceof Error ? error.cause : undefined;
  return codeOf(cause) === "23505";
}
