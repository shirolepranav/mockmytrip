#!/usr/bin/env node
/*
 * Anti-vibe-code gate (Phase 0 task 12, docs/DESIGN_SYSTEM.md §2).
 * Scans source for banned patterns:
 *  - Inter/Roboto/Arial/system-ui/Space Grotesk used as a font-family
 *  - purple→blue/indigo/violet gradients (Tailwind or raw CSS)
 *  - raw hex colors outside the two allowlisted token files
 * Exits 1 with a report when a violation is found. Used by `npm run lint:styles`
 * and CI on every commit.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "actions"];
const SCAN_EXTENSIONS = [".ts", ".tsx", ".css", ".mjs"];

/** Files allowed to contain raw hex — the token sources of truth. */
const HEX_ALLOWLIST = new Set(["app/globals.css", "lib/design/colors.ts"]);

/** Rules applied to every scanned file. `hex` is handled separately. */
const RULES = [
  {
    id: "banned-display-font",
    description:
      "Inter/Roboto/Arial/system-ui/Space Grotesk must not be used as a font family",
    // Matches font-family declarations or next/font imports of banned faces.
    pattern:
      /font-family\s*:\s*[^;]*\b(Inter|Roboto|Arial|system-ui|Space Grotesk)\b|next\/font\/google["'][^]*?\b(Inter|Roboto|Space_Grotesk)\b/i,
  },
  {
    id: "banned-gradient",
    description: "Purple→blue/indigo/violet gradients are banned",
    pattern:
      /\b(?:from|via|to)-(?:purple|indigo|violet)-\d+\b|linear-gradient\([^)]*(?:purple|indigo|violet)[^)]*\)/i,
  },
];

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;

/** Lines that legitimately contain a # but aren't color hex (urls, ids). */
function isRealHexUsage(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
  // SVG data URIs use %23 for #, so raw # hex in a data URI won't appear.
  return true;
}

export function checkContent(content, relPath) {
  const violations = [];
  for (const rule of RULES) {
    if (rule.pattern.test(content)) {
      violations.push({ file: relPath, rule: rule.id, detail: rule.description });
    }
  }
  if (!HEX_ALLOWLIST.has(relPath)) {
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      const matches = line.match(HEX_PATTERN);
      if (matches && isRealHexUsage(line)) {
        violations.push({
          file: relPath,
          rule: "raw-hex-outside-tokens",
          detail: `line ${index + 1}: ${matches.join(", ")} — use CSS variables / lib/design/colors.ts`,
        });
      }
    });
  }
  return violations;
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry === "fonts") continue;
      yield* walk(full);
    } else if (SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      yield full;
    }
  }
}

export function runCheck(rootDir = ROOT) {
  const allViolations = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(rootDir, dir))) {
      const relPath = relative(rootDir, file);
      const content = readFileSync(file, "utf8");
      allViolations.push(...checkContent(content, relPath));
    }
  }
  return allViolations;
}

// CLI entry — only run when invoked directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  const violations = runCheck();
  if (violations.length > 0) {
    console.error("✖ Banned-style violations found:\n");
    for (const violation of violations) {
      console.error(`  ${violation.file} [${violation.rule}] ${violation.detail}`);
    }
    process.exit(1);
  }
  console.log("✓ No banned styles found.");
}
