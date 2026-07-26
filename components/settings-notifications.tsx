"use client";

import { useState } from "react";
import { updateMoodCheckinsAction } from "@/actions/user";
import { PushOptInToggle } from "@/components/push-opt-in-toggle";
import { ToggleSwitch } from "@/components/toggle-switch";

/*
 * Notifications section (Phase 8 task 6). The 1-push-per-day cap is shown
 * as informational copy, not a user-adjustable dial — the cap is a system
 * guarantee against notification creep (golden rule #3: no dark patterns),
 * not a lever that should only ever mean "notify me more."
 */
export function SettingsNotifications({
  vapidPublicKey,
  initialOptIn,
  initialMoodCheckins,
}: {
  vapidPublicKey?: string;
  initialOptIn: boolean;
  initialMoodCheckins: boolean;
}) {
  const [moodCheckins, setMoodCheckins] = useState(initialMoodCheckins);

  async function handleMoodChange(next: boolean) {
    setMoodCheckins(next);
    await updateMoodCheckinsAction(next);
  }

  return (
    <div className="flex flex-col gap-s4">
      <div className="flex flex-col gap-s2">
        <span className="text-sm font-semibold">Push notifications</span>
        <PushOptInToggle vapidPublicKey={vapidPublicKey} initialOptIn={initialOptIn} />
        <p className="text-xs text-ink-soft">
          At most one nudge a day — countdown milestones and when your
          memories unlock. Never more, and always opt-in.
        </p>
      </div>

      <div className="flex items-center justify-between gap-s3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Mood check-in</span>
          <p className="text-xs text-ink-soft">
            A quick, optional before/after check-in — never used to nudge you.
          </p>
        </div>
        <ToggleSwitch
          checked={moodCheckins}
          onChange={handleMoodChange}
          label="Mood check-in"
          testId="mood-checkin-toggle"
        />
      </div>
    </div>
  );
}
