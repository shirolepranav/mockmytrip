"use client";

import { useState } from "react";
import type { RoomType } from "@/lib/engine/hotel-flavor";
import { IconBed } from "@/components/icons";
import { formatMoney } from "@/lib/format";

/*
 * Room-type tier picker (WF §8 "room types"), mirroring FareOptions.
 * Purely presentational — swapping tiers only changes the displayed price/
 * perks; "Select hotel" always persists the offer's own nightly/total price
 * regardless (ethical-guardrails rule 1: checkout is always $0.00).
 */
export function RoomTypes({ options }: { options: RoomType[] }) {
  const [selected, setSelected] = useState(
    options.find((option) => option.id === "standard")?.id ?? options[0]?.id,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Room types"
      className="flex flex-col gap-s2"
    >
      {options.map((option) => {
        const isSelected = option.id === selected;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setSelected(option.id)}
            className={`flex items-center justify-between gap-s3 rounded-card border p-s3 text-left ${
              isSelected
                ? "border-ink bg-paper2"
                : "border-line bg-paper hover:bg-paper2"
            }`}
          >
            <div className="flex min-w-0 items-start gap-s2">
              <IconBed size={18} className="mt-0.5 shrink-0 text-ink-soft" />
              <div className="min-w-0">
                <p className="font-semibold">{option.name}</p>
                <p className="text-sm text-ink-soft">
                  {option.perks.join(" · ")}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-serif text-lg font-semibold">
                {formatMoney(option.nightlyCents)}
              </p>
              <p className="text-xs font-semibold text-mint-ok">
                save {formatMoney(option.savedCents)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
