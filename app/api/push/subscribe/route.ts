import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSessionUserId } from "@/lib/auth/session";
import { removeSubscription, upsertSubscription } from "@/lib/services/push";

/*
 * Web push subscribe/unsubscribe (Phase 8 task 4). Both also flip
 * `users.prefs_json.notifOptIn` (via lib/services/push.ts) so the Settings
 * toggle and the actual subscription rows never drift out of sync.
 */

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: NextRequest) {
  const userId = await readSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const parsed = subscriptionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  await upsertSubscription(userId, parsed.data);
  return NextResponse.json({ ok: true });
}

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export async function DELETE(request: NextRequest) {
  const userId = await readSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const parsed = unsubscribeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  await removeSubscription(userId, parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
