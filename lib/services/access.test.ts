// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

/*
 * @phase9 access-resolution suite against embedded in-memory PGlite:
 * role resolution (owner/editor/viewer/denied) and assertCanEdit's
 * viewer rejection.
 */

process.env.PGLITE_MEMORY = "1";

import { getDb, schema } from "@/lib/db/client";
import { createGuest } from "@/lib/services/users";
import { createTrip } from "@/lib/services/trips";
import { OwnershipError } from "./ownership";
import { assertCanEdit, assertCanView, resolveAccess } from "./access";

beforeAll(async () => {
  await getDb(); // triggers embedded migration
});

async function makeTrip(userId: string) {
  const startDate = new Date("2026-09-01T00:00:00Z");
  const endDate = new Date("2026-09-04T00:00:00Z");
  return createTrip(userId, {
    title: "Test trip",
    destinationCity: "Lisbon",
    destinationCountry: "PT",
    startDate,
    endDate,
  });
}

async function addCollaborator(
  tripId: string,
  userId: string,
  role: "viewer" | "editor",
) {
  const db = await getDb();
  await db.insert(schema.tripCollaborators).values({ tripId, userId, role });
}

describe("@phase9 resolveAccess", () => {
  it("the trip owner resolves to role owner", async () => {
    const owner = await createGuest();
    const trip = await makeTrip(owner.id);
    const access = await resolveAccess(owner.id, trip.id);
    expect(access.role).toBe("owner");
    expect(access.trip.id).toBe(trip.id);
  });

  it("a collaborator resolves to their stored role", async () => {
    const owner = await createGuest();
    const editor = await createGuest();
    const viewer = await createGuest();
    const trip = await makeTrip(owner.id);
    await addCollaborator(trip.id, editor.id, "editor");
    await addCollaborator(trip.id, viewer.id, "viewer");

    expect((await resolveAccess(editor.id, trip.id)).role).toBe("editor");
    expect((await resolveAccess(viewer.id, trip.id)).role).toBe("viewer");
  });

  it("a stranger with no collaborator row is denied", async () => {
    const owner = await createGuest();
    const stranger = await createGuest();
    const trip = await makeTrip(owner.id);
    await expect(resolveAccess(stranger.id, trip.id)).rejects.toThrow(
      OwnershipError,
    );
  });

  it("a nonexistent trip id is denied the same way as an unauthorized one", async () => {
    const user = await createGuest();
    await expect(
      resolveAccess(user.id, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(OwnershipError);
  });
});

describe("@phase9 assertCanView / assertCanEdit", () => {
  it("owner and editor can view and edit; viewer can only view", async () => {
    const owner = await createGuest();
    const editor = await createGuest();
    const viewer = await createGuest();
    const trip = await makeTrip(owner.id);
    await addCollaborator(trip.id, editor.id, "editor");
    await addCollaborator(trip.id, viewer.id, "viewer");

    await expect(assertCanView(owner.id, trip.id)).resolves.toBeDefined();
    await expect(assertCanView(editor.id, trip.id)).resolves.toBeDefined();
    await expect(assertCanView(viewer.id, trip.id)).resolves.toBeDefined();

    await expect(assertCanEdit(owner.id, trip.id)).resolves.toBeDefined();
    await expect(assertCanEdit(editor.id, trip.id)).resolves.toBeDefined();
    await expect(assertCanEdit(viewer.id, trip.id)).rejects.toThrow(
      OwnershipError,
    );
  });

  it("a non-collaborator is denied by both", async () => {
    const owner = await createGuest();
    const stranger = await createGuest();
    const trip = await makeTrip(owner.id);

    await expect(assertCanView(stranger.id, trip.id)).rejects.toThrow(
      OwnershipError,
    );
    await expect(assertCanEdit(stranger.id, trip.id)).rejects.toThrow(
      OwnershipError,
    );
  });
});
