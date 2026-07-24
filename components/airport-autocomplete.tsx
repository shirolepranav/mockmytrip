"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  loadAirports,
  searchAirports,
  type SlimAirport,
} from "@/lib/airports-client";
import { IconPlane } from "@/components/icons";

/*
 * Airport autocomplete (Phase 3 task 1): client-side fuzzy search over the
 * slim JSON, combobox keyboard pattern, floating label, taxiing-plane focus
 * animation (reduced-motion aware via [data-motion]), recent-search chips.
 */

const RECENTS_KEY = "wanderlost.recent-airports";
const MAX_RECENTS = 4;

function readRecents(): SlimAirport[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as SlimAirport[]) : [];
  } catch {
    return [];
  }
}

export function rememberRecent(airport: SlimAirport) {
  try {
    const next = [
      airport,
      ...readRecents().filter((entry) => entry.iata !== airport.iata),
    ].slice(0, MAX_RECENTS);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable — recents are a nicety only.
  }
}

interface AirportAutocompleteProps {
  label: string;
  name: string;
  initial?: SlimAirport | null;
  error?: string;
  onSelect?: (airport: SlimAirport | null) => void;
}

export function AirportAutocomplete({
  label,
  name,
  initial = null,
  error,
  onSelect,
}: AirportAutocompleteProps) {
  const inputId = useId();
  const listboxId = useId();
  const [text, setText] = useState(
    initial ? `${initial.city} (${initial.iata})` : "",
  );
  const [selected, setSelected] = useState<SlimAirport | null>(initial);
  const [options, setOptions] = useState<SlimAirport[]>([]);
  const [recents, setRecents] = useState<SlimAirport[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Warm the index and recents on focus.
  const handleFocus = useCallback(() => {
    setFocused(true);
    void loadAirports();
    setRecents(readRecents());
    setOpen(true);
  }, []);

  const updateQuery = useCallback(async (value: string) => {
    setText(value);
    setSelected(null);
    onSelect?.(null);
    const airports = await loadAirports();
    setOptions(searchAirports(airports, value));
    setActiveIndex(-1);
    setOpen(true);
  }, [onSelect]);

  const choose = useCallback(
    (airport: SlimAirport) => {
      setSelected(airport);
      setText(`${airport.city} (${airport.iata})`);
      setOpen(false);
      rememberRecent(airport);
      onSelect?.(airport);
    },
    [onSelect],
  );

  // Close on outside tap.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const visible = text.trim().length >= 2 ? options : recents;
  const showList = open && visible.length > 0;
  const floating = focused || text.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <label
          htmlFor={inputId}
          className={`pointer-events-none absolute left-s3 transition-all duration-150 ${
            floating
              ? "top-1 text-xs font-semibold text-horizon-deep"
              : "top-1/2 -translate-y-1/2 text-base text-ink-soft"
          }`}
        >
          {label}
        </label>
        <input
          id={inputId}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          autoComplete="off"
          value={text}
          onChange={(event) => void updateQuery(event.target.value)}
          onFocus={handleFocus}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (!showList) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % visible.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex(
                (index) => (index - 1 + visible.length) % visible.length,
              );
            } else if (event.key === "Enter" && activeIndex >= 0) {
              event.preventDefault();
              choose(visible[activeIndex]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="min-h-14 w-full rounded-card border border-line bg-paper2 px-s3 pt-4 pb-1 text-base"
        />
        {/* Hidden field carrying the IATA for form submission */}
        <input type="hidden" name={name} value={selected?.iata ?? ""} />
        {/* Taxiing plane underline on focus */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-s3 bottom-1 left-s3 h-4 overflow-hidden"
        >
          <span
            className={`absolute bottom-0 text-horizon transition-all ease-out ${
              focused
                ? "translate-x-[calc(100%+1rem)] opacity-0 duration-1000 [html[data-motion=reduced]_&]:translate-x-0 [html[data-motion=reduced]_&]:opacity-100 [html[data-motion=reduced]_&]:duration-0"
                : "translate-x-0 opacity-0 duration-0"
            }`}
            style={{ left: 0 }}
          >
            <IconPlane size={14} />
          </span>
        </span>
      </div>

      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-s1 text-sm text-alert">
          {error}
        </p>
      ) : null}

      {showList ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="ticket-surface absolute z-30 mt-s1 max-h-72 w-full overflow-auto py-s1 shadow-e2"
        >
          {text.trim().length < 2 && visible.length > 0 ? (
            <li
              aria-hidden
              className="px-s3 py-s1 font-mono text-xs tracking-widest text-ink-soft uppercase"
            >
              Recent
            </li>
          ) : null}
          {visible.map((airport, index) => (
            <li
              key={airport.iata}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-s2 px-s3 py-s1 ${
                index === activeIndex ? "bg-paper" : ""
              }`}
              onPointerDown={(event) => {
                event.preventDefault(); // keep input focus
                choose(airport);
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {airport.city}
                  <span className="ml-s1 text-sm font-normal text-ink-soft">
                    {airport.country}
                  </span>
                </span>
                <span className="block truncate text-sm text-ink-soft">
                  {airport.name}
                </span>
              </span>
              <span className="shrink-0 font-mono text-sm font-semibold text-horizon-deep">
                {airport.iata}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
