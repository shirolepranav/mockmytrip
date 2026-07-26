/*
 * RFC 5545 primitives — pure, no DB, unit-tested directly. Used by
 * lib/calendar/build.ts to assemble the VCALENDAR text.
 */

/**
 * Fold a physical line at 75 octets per RFC 5545 §3.1. Operates on UTF-8
 * bytes (not JS string length) and never splits a multi-byte sequence — a
 * continuation-byte check backs the boundary off by one byte at a time
 * until it lands on a character start. Continuation lines are joined with
 * CRLF + a single leading space, the standard "unfold by stripping
 * CRLF+space" format.
 */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const chunks: Buffer[] = [];
  let offset = 0;
  let limit = 75;
  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);
    while (end < bytes.length && (bytes[end] & 0b11000000) === 0b10000000) {
      end--;
    }
    chunks.push(bytes.subarray(offset, end));
    offset = end;
    limit = 74; // continuation lines carry a leading space, so 74 content octets + 1 space = 75
  }
  return chunks
    .map((chunk, index) => (index === 0 ? chunk : Buffer.concat([Buffer.from(" "), chunk])).toString("utf8"))
    .join("\r\n");
}

/** Escape a TEXT-typed value per RFC 5545 §3.3.11 — backslash, semicolon, comma, newline. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** `YYYYMMDDTHHMMSSZ` — a UTC DATE-TIME value. */
export function formatUtcStamp(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** `YYYYMMDD` — a DATE-only value (all-day events, `VALUE=DATE`). */
export function formatDateOnly(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}${pad(month)}${pad(day)}`;
}
