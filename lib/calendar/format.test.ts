import { describe, expect, it } from "vitest";
import { escapeIcsText, foldLine, formatDateOnly, formatUtcStamp } from "./format";

/*
 * @phase9 .ics primitive suite — RFC 5545 §3.1 line folding (byte-accurate,
 * multi-byte-safe) and §3.3.11 text escaping.
 */

describe("@phase9 foldLine", () => {
  it("leaves a short line untouched", () => {
    const line = "SUMMARY:Short";
    expect(foldLine(line)).toBe(line);
  });

  it("folds a line over 75 octets, continuation lines prefixed with a space", () => {
    const long = "DESCRIPTION:" + "a".repeat(100);
    const folded = foldLine(long);
    const physicalLines = folded.split("\r\n");
    expect(physicalLines.length).toBeGreaterThan(1);
    expect(Buffer.byteLength(physicalLines[0], "utf8")).toBeLessThanOrEqual(75);
    for (const line of physicalLines.slice(1)) {
      expect(line.startsWith(" ")).toBe(true);
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    // Unfolding (strip CRLF + following space) reconstructs the original.
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });

  it("never splits a multi-byte UTF-8 character across a fold boundary", () => {
    // ✈ (U+2708) is 3 bytes in UTF-8 — pad so a naive 75-byte cut lands mid-character.
    const long = "SUMMARY:" + "x".repeat(70) + "✈✈✈✈✈✈✈✈✈✈";
    const folded = foldLine(long);
    for (const line of folded.split("\r\n")) {
      // A corrupted split produces invalid UTF-8, which Buffer.from(...,"utf8")
      // silently replaces with U+FFFD on decode — assert it round-trips clean.
      const stripped = line.startsWith(" ") ? line.slice(1) : line;
      expect(Buffer.from(stripped, "utf8").toString("utf8")).not.toContain("�");
    }
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });
});

describe("@phase9 escapeIcsText", () => {
  it("escapes backslash, semicolon, comma, and newlines", () => {
    expect(escapeIcsText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeIcsText("Lisbon, day one")).not.toBe("Lisbon, day one"); // comma IS escaped
    expect(escapeIcsText("Lisbon")).toBe("Lisbon");
  });
});

describe("@phase9 date/time formatting", () => {
  it("formatUtcStamp produces YYYYMMDDTHHMMSSZ", () => {
    const ms = Date.UTC(2026, 7, 15, 9, 5, 3); // 2026-08-15 09:05:03 UTC
    expect(formatUtcStamp(ms)).toBe("20260815T090503Z");
  });

  it("formatDateOnly produces YYYYMMDD, zero-padded", () => {
    expect(formatDateOnly(2026, 8, 5)).toBe("20260805");
    expect(formatDateOnly(2026, 12, 31)).toBe("20261231");
  });
});
