"use client";

import { useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import type {
  ItineraryCategory,
  ItineraryItemRow as ItemRow,
} from "@/lib/services/itinerary";
import { IconChevronLeft, IconChevronRight, IconClose, IconGrip } from "@/components/icons";

const CATEGORY_LABELS: Record<ItineraryCategory, string> = {
  food: "Food",
  sight: "Sight",
  activity: "Activity",
  transit: "Transit",
  rest: "Rest",
};

export interface ItineraryEditPatch {
  title?: string;
  time?: string | null;
  note?: string | null;
  category?: ItineraryCategory;
}

/*
 * One itinerary item (WF §14): drag handle (≥44px, dragListener={false} so
 * taps elsewhere on the row stay reachable), inline edit, delete, and a
 * keyboard/touch-friendly "move to day" alternative to dragging between
 * day columns.
 */
export function ItineraryItemRow({
  item,
  dayCount,
  onEdit,
  onDelete,
  onMoveDay,
  onDragEnd,
}: {
  item: ItemRow;
  dayCount: number;
  onEdit: (itemId: string, patch: ItineraryEditPatch) => void;
  onDelete: (item: ItemRow) => void;
  onMoveDay: (item: ItemRow, direction: -1 | 1) => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [time, setTime] = useState(item.time ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [category, setCategory] = useState<ItineraryCategory>(item.category);

  function save() {
    onEdit(item.id, {
      title: title.trim() || item.title,
      time: time.trim() ? time.trim() : null,
      note: note.trim() ? note.trim() : null,
      category,
    });
    setEditing(false);
  }

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      data-testid="itinerary-item"
      className="ticket-surface flex flex-col gap-s2 p-s3"
    >
      <div className="flex items-start gap-s2">
        <button
          type="button"
          onPointerDown={(event) => controls.start(event)}
          aria-label="Drag to reorder"
          data-testid="itinerary-drag-handle"
          className="flex min-h-11 min-w-11 shrink-0 touch-none items-center justify-center text-ink-soft"
          style={{ cursor: "grab" }}
        >
          <IconGrip size={18} />
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {editing ? (
            <div className="flex flex-col gap-s2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                data-testid="itinerary-edit-title"
                className="min-h-11 rounded-card border border-line bg-paper2 px-s3 text-sm"
              />
              <div className="flex flex-wrap gap-s2">
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="min-h-11 rounded-card border border-line bg-paper2 px-s2 text-sm"
                />
                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as ItineraryCategory)
                  }
                  className="min-h-11 rounded-card border border-line bg-paper2 px-s2 text-sm"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Note (optional)"
                maxLength={280}
                className="min-h-11 rounded-card border border-line bg-paper2 px-s3 py-s2 text-sm"
              />
              <div className="flex gap-s2">
                <button
                  type="button"
                  onClick={save}
                  data-testid="itinerary-edit-save"
                  className="min-h-11 rounded-pill bg-ink px-s3 text-sm font-semibold text-paper2"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="min-h-11 rounded-pill px-s3 text-sm font-semibold text-ink-soft hover:bg-paper2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex flex-col items-start gap-0.5 text-left"
              data-testid="itinerary-item-title"
            >
              <span className="flex items-center gap-s2 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                {item.time ? <span className="font-mono">{item.time}</span> : null}
                <span>{CATEGORY_LABELS[item.category]}</span>
              </span>
              <span className="font-display text-base">{item.title}</span>
              {item.note ? (
                <span className="text-sm text-ink-soft">{item.note}</span>
              ) : null}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDelete(item)}
          aria-label={`Delete ${item.title}`}
          data-testid="itinerary-delete"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-pill text-ink-soft hover:bg-paper2"
        >
          <IconClose size={16} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-s2 border-t border-line pt-s2">
        <button
          type="button"
          onClick={() => onMoveDay(item, -1)}
          disabled={item.dayIndex === 0}
          aria-label="Move to previous day"
          data-testid="itinerary-move-prev"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-pill text-ink-soft hover:bg-paper2 disabled:opacity-30"
        >
          <IconChevronLeft size={16} />
        </button>
        <span className="text-xs text-ink-soft">Day {item.dayIndex + 1}</span>
        <button
          type="button"
          onClick={() => onMoveDay(item, 1)}
          disabled={item.dayIndex >= dayCount - 1}
          aria-label="Move to next day"
          data-testid="itinerary-move-next"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-pill text-ink-soft hover:bg-paper2 disabled:opacity-30"
        >
          <IconChevronRight size={16} />
        </button>
      </div>
    </Reorder.Item>
  );
}
