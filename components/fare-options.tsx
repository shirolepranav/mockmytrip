"use client";

import { useState } from "react";
import type { FareOption } from "@/lib/engine/flavor";
import { formatMoney } from "@/lib/format";

/*
 * Fare tier picker (WF §5 "fare options"). Purely presentational — swapping
 * tiers only changes the displayed price/perks; checkout is always $0.00
 * regardless (ethical-guardrails rule 1), so the selection never leaves the
 * client and isn't part of what "Select this flight" persists.
 */
export function FareOptions({ options }: { options: FareOption[] }) {
  const [selected, setSelected] = useState(
    options.find((option) => option.id === "standard")?.id ?? options[0]?.id,
  );

  return (
    <div role="radiogroup" aria-label="Fare options" className="flex flex-col gap-s2">
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
            <div className="min-w-0">
              <p className="font-semibold">{option.name}</p>
              <p className="text-sm text-ink-soft">
                {option.perks.join(" · ")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-serif text-lg font-semibold">
                {formatMoney(option.priceCents)}
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
