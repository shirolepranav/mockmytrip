"use client";

import Link from "next/link";
import { Reorder } from "motion/react";
import {
  ItineraryItemRow,
  type ItineraryEditPatch,
} from "@/components/itinerary-item-row";
import type { ItineraryItemRow as ItemRow } from "@/lib/services/itinerary";

/*
 * One day's column (WF §14). Within-day reorder uses Motion's Reorder.Group
 * directly — `onReorder` gives live visual feedback on every drag frame;
 * the actual server persistence fires once, on the dragged item's
 * `onDragEnd`, via the parent's `onReorderCommit`.
 */
export function ItineraryDayColumn({
  tripId,
  dayIndex,
  dayLabel,
  items,
  dayCount,
  canEdit = true,
  attributionFor,
  onReorderLive,
  onReorderCommit,
  onEdit,
  onDelete,
  onMoveDay,
  onAddClick,
}: {
  tripId: string;
  dayIndex: number;
  dayLabel: string;
  items: ItemRow[];
  dayCount: number;
  /** False for a viewer-role collaborator — read-only list, no add/drag/edit/delete. */
  canEdit?: boolean;
  /** "added by {name}" chip text for a given item, or null for the owner's own items. */
  attributionFor?: (item: ItemRow) => string | null;
  onReorderLive: (dayIndex: number, items: ItemRow[]) => void;
  onReorderCommit: (dayIndex: number) => void;
  onEdit: (itemId: string, patch: ItineraryEditPatch) => void;
  onDelete: (item: ItemRow) => void;
  onMoveDay: (item: ItemRow, direction: -1 | 1) => void;
  onAddClick: (dayIndex: number) => void;
}) {
  return (
    <div
      className="flex w-full flex-col gap-s3 sm:w-80 sm:shrink-0"
      data-testid={`itinerary-day-${dayIndex}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Day {dayIndex + 1}</h2>
        <span className="text-xs text-ink-soft">{dayLabel}</span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-card border border-dashed border-line p-s4 text-center text-sm text-ink-soft">
          Nothing planned yet.
        </p>
      ) : canEdit ? (
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={(newOrder) => onReorderLive(dayIndex, newOrder)}
          className="flex flex-col gap-s3"
          data-testid={`itinerary-day-list-${dayIndex}`}
        >
          {items.map((item) => (
            <ItineraryItemRow
              key={item.id}
              item={item}
              dayCount={dayCount}
              attributionLabel={attributionFor?.(item) ?? null}
              onEdit={onEdit}
              onDelete={onDelete}
              onMoveDay={onMoveDay}
              onDragEnd={() => onReorderCommit(dayIndex)}
            />
          ))}
        </Reorder.Group>
      ) : (
        <div
          className="flex flex-col gap-s3"
          data-testid={`itinerary-day-list-${dayIndex}`}
        >
          {items.map((item) => (
            <ItineraryItemRow
              key={item.id}
              item={item}
              dayCount={dayCount}
              readOnly
              attributionLabel={attributionFor?.(item) ?? null}
            />
          ))}
        </div>
      )}

      {canEdit ? (
        <div className="flex flex-wrap gap-s2">
          <button
            type="button"
            onClick={() => onAddClick(dayIndex)}
            data-testid="itinerary-add-button"
            className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill border border-line px-s4 text-sm font-semibold text-ink hover:bg-paper2"
          >
            + Add item
          </button>
          <Link
            href={`/trips/${tripId}/explore`}
            data-testid="itinerary-add-from-explore"
            className="press-physical inline-flex min-h-11 items-center justify-center rounded-pill border border-line px-s4 text-sm font-semibold text-ink hover:bg-paper2"
          >
            Add from Explore
          </Link>
        </div>
      ) : null}
    </div>
  );
}
