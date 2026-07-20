/*
 * Ownership assertion used by every service that touches user-owned rows.
 * Throws a typed error the actions layer maps to a 403-style denial with
 * zero information leak.
 */

export class OwnershipError extends Error {
  constructor() {
    // Deliberately vague: never reveal whether the resource exists.
    super("Not found");
    this.name = "OwnershipError";
  }
}

export function assertOwner(
  userId: string,
  resource: { userId: string } | undefined | null,
): asserts resource is { userId: string } {
  if (!resource || resource.userId !== userId) throw new OwnershipError();
}
