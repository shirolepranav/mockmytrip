"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMotionPrefs } from "@/lib/motion/reduced-motion";
import {
  addCustomItemAction,
  deletePackingItemAction,
  generateStarterPackingListAction,
  resetToAutoAction,
  toggleCheckedAction,
} from "@/actions/packing";
import type { PackingItemRow } from "@/lib/services/packing";
import { IconCheck, IconClose } from "@/components/icons";
import { OfflineBanner } from "@/components/offline-banner";
import { useOfflineQueue } from "@/lib/offline/use-offline-queue";
import type { QueuedMutation } from "@/lib/offline/mutation-queue";

/*
 * Packing list (WF §15): auto-generated starter list, satisfying tick
 * micro-interaction, progress bar, add custom, reset-to-auto, a small
 * all-checked celebration (reduced-motion safe, fires once per completion).
 *
 * Toggling/adding/deleting here are simple, idempotent local-state updates
 * awaiting their server action directly — no useOptimistic layering, since
 * (unlike the itinerary board's add/reorder) there's no risk of the
 * optimistic dispatch and the confirmed-state update double-applying in
 * the same render batch.
 *
 * Offline handling is the same Phase 7 scaffold as the itinerary board
 * (see components/itinerary-board.tsx) — mutations queue in IndexedDB while
 * offline and replay in order on reconnect.
 */

const CATEGORY_LABELS: Record<string, string> = {
  clothing: "Clothing",
  docs: "Docs",
  tech: "Tech",
  toiletries: "Toiletries",
  misc: "Misc",
};
const CATEGORY_ORDER = ["clothing", "docs", "tech", "toiletries", "misc"];

export function PackingList({
  tripId,
  initialItems,
}: {
  tripId: string;
  initialItems: PackingItemRow[];
}) {
  const { reduced } = useMotionPrefs();
  const [items, setItems] = useState(initialItems);
  const [generating, setGenerating] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [customLabel, setCustomLabel] = useState("");

  const replayMutation = useCallback(async (mutation: QueuedMutation) => {
    switch (mutation.kind) {
      case "packing.toggle":
        await toggleCheckedAction(
          mutation.payload as Parameters<typeof toggleCheckedAction>[0],
        );
        return;
      case "packing.add":
        await addCustomItemAction(
          mutation.payload as Parameters<typeof addCustomItemAction>[0],
        );
        return;
      case "packing.delete":
        await deletePackingItemAction(
          mutation.payload as Parameters<typeof deletePackingItemAction>[0],
        );
        return;
    }
  }, []);
  const { isOffline, queueMutation } = useOfflineQueue(replayMutation);

  const checkedCount = items.filter((item) => item.isChecked).length;
  const progress = items.length === 0 ? 0 : Math.round((checkedCount / items.length) * 100);
  const allChecked = items.length > 0 && checkedCount === items.length;

  // Adjusted during render (React's sanctioned "derive state from a
  // computed value" pattern) rather than in an effect, so the celebration
  // fires exactly once per completion streak with no extra render pass.
  if (allChecked && !celebrated) {
    setCelebrated(true);
    setShowCelebration(true);
  } else if (!allChecked && celebrated) {
    setCelebrated(false);
  }

  // The auto-hide timer is a legitimate effect: it reacts to
  // `showCelebration` becoming true and calls setState from its callback,
  // not synchronously in the effect body.
  useEffect(() => {
    if (!showCelebration) return;
    const timer = setTimeout(() => setShowCelebration(false), reduced ? 0 : 2200);
    return () => clearTimeout(timer);
  }, [showCelebration, reduced]);

  const grouped = useMemo(() => {
    const groups: Record<string, PackingItemRow[]> = {};
    for (const item of items) {
      (groups[item.category] ??= []).push(item);
    }
    return groups;
  }, [items]);

  async function handleGenerate() {
    setGenerating(true);
    const generated = await generateStarterPackingListAction({ tripId });
    if (generated) setItems((prev) => [...prev, ...generated]);
    setGenerating(false);
  }

  function handleToggle(itemId: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, isChecked: !item.isChecked } : item,
      ),
    );
    if (isOffline) {
      void queueMutation("packing.toggle", { itemId, tripId });
    } else {
      void toggleCheckedAction({ itemId, tripId });
    }
  }

  function handleDelete(itemId: string) {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    if (isOffline) {
      void queueMutation("packing.delete", { itemId, tripId });
    } else {
      void deletePackingItemAction({ itemId, tripId });
    }
  }

  async function handleAddCustom(event: FormEvent) {
    event.preventDefault();
    const label = customLabel.trim();
    if (!label) return;
    setCustomLabel("");
    if (isOffline) {
      // Queued for replay — no server id available yet, so the item only
      // appears locally until the next reload after it replays (Phase 8
      // brings cached reads that would keep this in sync across reloads).
      await queueMutation("packing.add", { tripId, label, category: "misc" });
      return;
    }
    const created = await addCustomItemAction({ tripId, label, category: "misc" });
    if (created) setItems((prev) => [...prev, created]);
  }

  async function handleReset() {
    const regenerated = await resetToAutoAction({ tripId });
    if (regenerated) {
      setItems((prev) => [...prev.filter((item) => !item.isAuto), ...regenerated]);
    }
  }

  if (items.length === 0) {
    return (
      <div className="ticket-surface flex flex-col items-center gap-s4 p-s6 text-center">
        <OfflineBanner visible={isOffline} />
        <p className="font-display text-xl">Nothing packed yet</p>
        <p className="max-w-prose text-sm text-ink-soft">
          We can start you off with a list tailored to your destination and
          trip length.
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          data-testid="packing-auto-generate"
          className="press-physical inline-flex min-h-11 items-center rounded-pill bg-ink px-s5 font-semibold text-paper2 disabled:opacity-60"
        >
          {generating ? "Packing your bag…" : "Auto-generate my list"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-s5">
      <OfflineBanner visible={isOffline} />
      <div className="ticket-surface flex flex-col gap-s3 p-s4">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span data-testid="packing-progress-label">
            {checkedCount} of {items.length} packed
          </span>
          <span>{progress}%</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-pill bg-paper2"
          data-testid="packing-progress-bar"
          data-progress={progress}
        >
          <motion.div
            className="h-full rounded-pill bg-mint-ok"
            animate={{ width: `${progress}%` }}
            transition={{ duration: reduced ? 0 : 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence>
        {showCelebration ? (
          <motion.p
            data-testid="packing-celebration"
            role="status"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.3 }}
            className="ticket-surface p-s4 text-center font-display text-lg text-mint-ok"
          >
            All packed! You&apos;re ready to (pretend) go.
          </motion.p>
        ) : null}
      </AnimatePresence>

      {CATEGORY_ORDER.filter((category) => grouped[category]?.length).map((category) => (
        <div key={category} className="flex flex-col gap-s2">
          <h2 className="font-display text-base text-ink-soft">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <ul className="flex flex-col gap-s2">
            {grouped[category].map((item) => (
              <PackingRow
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onDelete={handleDelete}
                reduced={reduced}
              />
            ))}
          </ul>
        </div>
      ))}

      <form onSubmit={handleAddCustom} className="flex gap-s2">
        <label className="sr-only" htmlFor="packing-custom-input">
          Add item
        </label>
        <input
          id="packing-custom-input"
          value={customLabel}
          onChange={(event) => setCustomLabel(event.target.value)}
          placeholder="Add your own item"
          maxLength={120}
          data-testid="packing-add-input"
          className="min-h-11 flex-1 rounded-card border border-line bg-paper2 px-s3"
        />
        <button
          type="submit"
          data-testid="packing-add-submit"
          className="min-h-11 rounded-pill bg-ink px-s4 font-semibold text-paper2"
        >
          Add
        </button>
      </form>

      <button
        type="button"
        onClick={handleReset}
        data-testid="packing-reset"
        className="self-start text-sm font-semibold text-ink-soft underline"
      >
        Reset to auto-generated list
      </button>
    </div>
  );
}

function PackingRow({
  item,
  onToggle,
  onDelete,
  reduced,
}: {
  item: PackingItemRow;
  onToggle: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  reduced: boolean;
}) {
  return (
    <li
      className="ticket-surface flex items-center gap-s3 p-s3"
      data-testid="packing-item"
    >
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        role="checkbox"
        aria-checked={item.isChecked}
        aria-label={item.label}
        data-testid="packing-item-toggle"
        className="flex min-h-11 min-w-11 items-center justify-center"
      >
        <motion.span
          animate={item.isChecked && !reduced ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: reduced ? 0 : 0.25 }}
          className={`flex h-6 w-6 items-center justify-center rounded-card border-2 ${
            item.isChecked ? "border-mint-ok bg-mint-ok text-paper2" : "border-line"
          }`}
        >
          {item.isChecked ? <IconCheck size={14} /> : null}
        </motion.span>
      </button>
      <span
        className={`flex-1 text-sm ${item.isChecked ? "text-ink-soft line-through" : ""}`}
      >
        {item.label}
      </span>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        aria-label={`Remove ${item.label}`}
        data-testid="packing-item-delete"
        className="flex min-h-11 min-w-11 items-center justify-center text-ink-soft hover:bg-paper2"
      >
        <IconClose size={14} />
      </button>
    </li>
  );
}
