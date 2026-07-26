"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clearSession, readSessionUserId } from "@/lib/auth/session";
import { deleteAll, updatePrefs } from "@/lib/services/users";

/** Hard delete everything, clear the cookie, land back on the marketing page. */
export async function deleteAllDataAction(): Promise<void> {
  const userId = await readSessionUserId();
  if (userId) await deleteAll(userId);
  await clearSession();
  redirect("/");
}

/** Mood check-in preference toggle (Phase 8 task 6) — a preference bit only;
 *  the actual before/after check-in prompt UI is future work. */
export async function updateMoodCheckinsAction(enabled: boolean): Promise<void> {
  const userId = await readSessionUserId();
  if (!userId) return;
  await updatePrefs(userId, { moodCheckins: enabled });
  revalidatePath("/settings");
}
