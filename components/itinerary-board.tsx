"use client";

import { useCallback, useMemo, useOptimistic, useRef, useState, useTransition, type FormEvent } from "react";
import {
  addItineraryItemAction,
  deleteItineraryItemAction,
  reorderItineraryItemsAction,
  updateItineraryItemAction,
} from "@/actions/itinerary";
import { AiSuggestButton, type AiSuggestedItem } from "@/components/ai-suggest-sheet";
import { ItineraryDayColumn } from "@/components/itinerary-day-column";
import type { ItineraryEditPatch } from "@/components/itinerary-item-row";
import { Sheet } from "@/components/sheet";
import { UndoToast } from "@/components/undo-toast";
import { useOfflineQueue } from "@/lib/offline/use-offline-queue";
import type { QueuedMutation } from "@/lib/offline/mutation-queue";
import type { ItineraryCategory, ItineraryItemRow } from "@/lib/services/itinerary";

/*
 * Itinerary board (WF §14): day columns, optimistic add/edit/reorder via
 * useOptimistic (TECH_SPEC §3), delete with an 8s undo window. Within-day
 * drag persists on drop; cross-day moves go through the "Move to day"
 * buttons on each row (a touch/keyboard-friendly alternative to dragging
 * between columns, always available alongside drag).
 *
 * Offline handling is a Phase 7 scaffold (full support — cached reads, a
 * service worker draining the queue in the background — lands in Phase 8):
 * while offline, mutations queue in IndexedDB instead of hitting the
 * server; on reconnect they replay in order. An add made while offline
 * keeps its temporary id until the next full page load after it replays.
 */

const UNDO_WINDOW_MS = 8000;

export const CATEGORY_OPTIONS: { value: ItineraryCategory; label: string }[] = [
  { value: "activity", label: "Activity" },
  { value: "sight", label: "Sight" },
  { value: "food", label: "Food" },
  { value: "transit", label: "Transit" },
  { value: "rest", label: "Rest" },
];

type Action =
  | { type: "add"; item: ItineraryItemRow }
  | { type: "update"; itemId: string; patch: Partial<ItineraryItemRow> }
  | { type: "remove"; itemId: string }
  | { type: "replaceDay"; dayIndex: number; items: ItineraryItemRow[] };

function reduce(state: ItineraryItemRow[], action: Action): ItineraryItemRow[] {
  switch (action.type) {
    case "add":
      return [...state, action.item];
    case "update":
      return state.map((item) =>
        item.id === action.itemId ? { ...item, ...action.patch } : item,
      );
    case "remove":
      return state.filter((item) => item.id !== action.itemId);
    case "replaceDay": {
      const rest = state.filter((item) => item.dayIndex !== action.dayIndex);
      return [...rest, ...action.items];
    }
  }
}

export function ItineraryBoard({
  tripId,
  destinationCity,
  initialItems,
  dayCount,
  dayLabels,
}: {
  tripId: string;
  destinationCity: string;
  initialItems: ItineraryItemRow[];
  dayCount: number;
  dayLabels: string[];
}) {
  const [confirmedItems, setConfirmedItems] = useState(initialItems);
  const [items, applyOptimistic] = useOptimistic(confirmedItems, reduce);
  const [, startTransition] = useTransition();

  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ItineraryItemRow | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replayMutation = useCallback(async (mutation: QueuedMutation) => {
    switch (mutation.kind) {
      case "itinerary.add":
        await addItineraryItemAction(
          mutation.payload as Parameters<typeof addItineraryItemAction>[0],
        );
        return;
      case "itinerary.update":
        await updateItineraryItemAction(
          mutation.payload as Parameters<typeof updateItineraryItemAction>[0],
        );
        return;
      case "itinerary.delete":
        await deleteItineraryItemAction(
          mutation.payload as Parameters<typeof deleteItineraryItemAction>[0],
        );
        return;
      case "itinerary.reorder":
        await reorderItineraryItemsAction(
          mutation.payload as Parameters<typeof reorderItineraryItemsAction>[0],
        );
        return;
    }
  }, []);
  const { isOffline, queueMutation } = useOfflineQueue(replayMutation);

  const byDay = useMemo(() => {
    const groups: ItineraryItemRow[][] = Array.from({ length: dayCount }, () => []);
    for (const item of items) {
      if (item.dayIndex >= 0 && item.dayIndex < dayCount) groups[item.dayIndex].push(item);
    }
    for (const day of groups) day.sort((a, b) => a.sortOrder - b.sortOrder);
    return groups;
  }, [items, dayCount]);

  function handleReorderLive(dayIndex: number, newOrder: ItineraryItemRow[]) {
    const withOrder = newOrder.map((item, index) => ({ ...item, sortOrder: index }));
    startTransition(() => {
      applyOptimistic({ type: "replaceDay", dayIndex, items: withOrder });
    });
  }

  function handleReorderCommit(dayIndex: number) {
    const dayItems = byDay[dayIndex];
    const moves = dayItems.map((item, index) => ({
      itemId: item.id,
      dayIndex,
      sortOrder: index,
    }));
    startTransition(async () => {
      if (isOffline) {
        await queueMutation("itinerary.reorder", { tripId, moves });
      } else {
        await reorderItineraryItemsAction({ tripId, moves });
      }
      setConfirmedItems((prev) => reduce(prev, { type: "replaceDay", dayIndex, items: dayItems }));
    });
  }

  function handleMoveDay(item: ItineraryItemRow, direction: -1 | 1) {
    const targetDay = Math.min(Math.max(item.dayIndex + direction, 0), dayCount - 1);
    if (targetDay === item.dayIndex) return;
    const patch = { dayIndex: targetDay, sortOrder: byDay[targetDay]?.length ?? 0 };

    const moves = [{ itemId: item.id, ...patch }];
    startTransition(async () => {
      applyOptimistic({ type: "update", itemId: item.id, patch });
      if (isOffline) {
        await queueMutation("itinerary.reorder", { tripId, moves });
      } else {
        await reorderItineraryItemsAction({ tripId, moves });
      }
      setConfirmedItems((prev) => reduce(prev, { type: "update", itemId: item.id, patch }));
    });
  }

  function handleEdit(itemId: string, patch: ItineraryEditPatch) {
    startTransition(async () => {
      applyOptimistic({ type: "update", itemId, patch });
      if (isOffline) {
        await queueMutation("itinerary.update", { itemId, tripId, ...patch });
      } else {
        await updateItineraryItemAction({ itemId, tripId, ...patch });
      }
      setConfirmedItems((prev) => reduce(prev, { type: "update", itemId, patch }));
    });
  }

  // Delete/undo are instant, client-only state changes (no server round trip
  // to wait for before showing the result), so they go straight through
  // `setConfirmedItems` rather than `useOptimistic`. Dispatching an
  // optimistic action AND synchronously updating the base state in the same
  // batch would double-apply once React reconciles the two — `useOptimistic`
  // is reserved for operations with a real async gap to bridge (add/edit/
  // reorder), where the dispatch and the eventual `setConfirmedItems` land
  // in different renders.
  function handleDelete(item: ItineraryItemRow) {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setConfirmedItems((prev) => reduce(prev, { type: "remove", itemId: item.id }));
    setPendingDelete(item);
    // Deferred commit: the real delete only reaches the server if the undo
    // window elapses without the user clicking "Undo" (QA 7.1).
    deleteTimerRef.current = setTimeout(() => {
      if (isOffline) {
        void queueMutation("itinerary.delete", { itemId: item.id, tripId });
      } else {
        void deleteItineraryItemAction({ itemId: item.id, tripId });
      }
      setPendingDelete(null);
    }, UNDO_WINDOW_MS);
  }

  function handleUndoDelete() {
    if (!pendingDelete) return;
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    const restored = pendingDelete;
    setPendingDelete(null);
    setConfirmedItems((prev) => reduce(prev, { type: "add", item: restored }));
  }

  function handleAdd(input: {
    title: string;
    time?: string;
    category: ItineraryCategory;
    note?: string;
  }) {
    if (addingDay === null) return;
    const dayIndex = addingDay;
    setAddingDay(null);
    const optimisticItem: ItineraryItemRow = {
      id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tripId,
      dayIndex,
      time: input.time ?? null,
      title: input.title,
      note: input.note ?? null,
      category: input.category,
      poiId: null,
      sortOrder: byDay[dayIndex]?.length ?? 0,
    };

    startTransition(async () => {
      applyOptimistic({ type: "add", item: optimisticItem });
      if (isOffline) {
        // Queued for replay on reconnect. The optimistic item keeps its
        // temporary id until then — reconciling it with the server-issued
        // id after a background replay is Phase 8 (needs the service
        // worker + cached reads to do safely across page loads).
        await queueMutation("itinerary.add", { tripId, dayIndex, ...input });
        return;
      }
      const created = await addItineraryItemAction({ tripId, dayIndex, ...input });
      if (created) {
        setConfirmedItems((prev) => [
          ...prev.filter((item) => item.id !== optimisticItem.id),
          created,
        ]);
      }
    });
  }

  /** Inserts every accepted AI suggestion the same way a manual add works. */
  function handleAcceptAiSuggestions(suggestions: AiSuggestedItem[]) {
    startTransition(async () => {
      for (const suggestion of suggestions) {
        const dayIndex = Math.min(Math.max(suggestion.dayIndex, 0), dayCount - 1);
        const optimisticItem: ItineraryItemRow = {
          id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          tripId,
          dayIndex,
          time: suggestion.time ?? null,
          title: suggestion.title,
          note: suggestion.note ?? null,
          category: suggestion.category,
          poiId: suggestion.poiId ?? null,
          sortOrder: 9999,
        };
        applyOptimistic({ type: "add", item: optimisticItem });

        const input = {
          tripId,
          dayIndex,
          title: suggestion.title,
          category: suggestion.category,
          time: suggestion.time,
          note: suggestion.note,
          poiId: suggestion.poiId,
        };
        if (isOffline) {
          await queueMutation("itinerary.add", input);
          continue;
        }
        const created = await addItineraryItemAction(input);
        if (created) {
          setConfirmedItems((prev) => [
            ...prev.filter((item) => item.id !== optimisticItem.id),
            created,
          ]);
        }
      }
    });
  }

  return (
    <div className="flex flex-col gap-s6">
      <AiSuggestButton
        tripId={tripId}
        city={destinationCity}
        days={dayCount}
        onAccept={handleAcceptAiSuggestions}
      />
      <div className="flex flex-col gap-s5 sm:flex-row sm:overflow-x-auto sm:pb-s3">
        {byDay.map((dayItems, dayIndex) => (
          <ItineraryDayColumn
            key={dayIndex}
            tripId={tripId}
            dayIndex={dayIndex}
            dayLabel={dayLabels[dayIndex] ?? ""}
            items={dayItems}
            dayCount={dayCount}
            onReorderLive={handleReorderLive}
            onReorderCommit={handleReorderCommit}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onMoveDay={handleMoveDay}
            onAddClick={setAddingDay}
          />
        ))}
      </div>

      <AddItemSheet
        open={addingDay !== null}
        onClose={() => setAddingDay(null)}
        onSubmit={handleAdd}
      />

      <UndoToast
        visible={pendingDelete !== null}
        message={pendingDelete ? `Removed "${pendingDelete.title}"` : ""}
        onUndo={handleUndoDelete}
      />
    </div>
  );
}

function AddItemSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    time?: string;
    category: ItineraryCategory;
    note?: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState<ItineraryCategory>("activity");
  const [note, setNote] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      time: time.trim() || undefined,
      category,
      note: note.trim() || undefined,
    });
    setTitle("");
    setTime("");
    setCategory("activity");
    setNote("");
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add itinerary item"
      testId="add-itinerary-sheet"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-s3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={120}
            data-testid="add-itinerary-title"
            className="min-h-11 rounded-card border border-line bg-paper2 px-s3"
          />
        </label>
        <div className="flex gap-s3">
          <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
            Time (optional)
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="min-h-11 rounded-card border border-line bg-paper2 px-s3"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as ItineraryCategory)}
              className="min-h-11 rounded-card border border-line bg-paper2 px-s3"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Note (optional)
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={280}
            className="min-h-11 rounded-card border border-line bg-paper2 px-s3 py-s2"
          />
        </label>
        <button
          type="submit"
          data-testid="add-itinerary-submit"
          className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill bg-ink px-s5 font-semibold text-paper2"
        >
          Add to day
        </button>
      </form>
    </Sheet>
  );
}
