/*
 * Shared display formatters. All time formatting is timezone-explicit so
 * server and client render identical strings (hydration-safe).
 */

export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: dollars >= 100 ? 0 : 2,
  }).format(dollars);
}

export function formatTimeInTz(utcMs: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(utcMs));
}

export function formatDateInTz(utcMs: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(utcMs));
}

/** YYYY-MM-DD in a given timezone — for prefilling <input type="date">. */
export function isoDateInTz(utcMs: number, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utcMs));
}

/** Add whole days to a YYYY-MM-DD date string, calendar-safe (no timezone). */
export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** +1 when the arrival lands on a later local date than departure. */
export function dayOffset(
  departUtcMs: number,
  departTz: string,
  arriveUtcMs: number,
  arriveTz: string,
): number {
  const depart = isoDateInTz(departUtcMs, departTz);
  const arrive = isoDateInTz(arriveUtcMs, arriveTz);
  return Math.round(
    (Date.parse(arrive) - Date.parse(depart)) / 86_400_000,
  );
}
