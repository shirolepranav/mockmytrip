"use server";

import { redirect } from "next/navigation";
import { clearSession, readSessionUserId } from "@/lib/auth/session";
import { deleteAll } from "@/lib/services/users";

/** Hard delete everything, clear the cookie, land back on the marketing page. */
export async function deleteAllDataAction(): Promise<void> {
  const userId = await readSessionUserId();
  if (userId) await deleteAll(userId);
  await clearSession();
  redirect("/");
}
