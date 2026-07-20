/*
 * Timezone math without a heavy dependency: convert a wall-clock time in an
 * IANA zone to UTC using Intl.DateTimeFormat (two-pass DST correction).
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let dtf = dtfCache.get(tz);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    dtfCache.set(tz, dtf);
  }
  return dtf;
}

/** Offset of `tz` from UTC (ms) at the given UTC instant. */
export function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = formatterFor(tz).formatToParts(new Date(utcMs));
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - utcMs;
}

/** UTC instant (ms) for a wall-clock date/time in an IANA zone. */
export function zonedToUtcMs(
  year: number,
  month: number, // 1-based
  day: number,
  hour: number,
  minute: number,
  tz: string,
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  let utc = naive - tzOffsetMs(naive, tz);
  // Second pass fixes wall times that straddle a DST transition.
  utc = naive - tzOffsetMs(utc, tz);
  return utc;
}

/** Format a UTC instant as local wall-clock parts in a zone (for display/tests). */
export function utcToZonedParts(utcMs: number, tz: string) {
  const local = new Date(utcMs + tzOffsetMs(utcMs, tz));
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}
