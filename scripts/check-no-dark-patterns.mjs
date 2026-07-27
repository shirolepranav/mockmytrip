#!/usr/bin/env node
/*
 * Dark-pattern guard (Phase 10 task 5, golden rule #3): no punishing
 * streaks, no false scarcity ("only 2 seats left!"), no countdown-to-book
 * pressure, no confirm-shaming. Scans source for scarcity/urgency copy.
 * Exits 1 with a report when a match is found. Used by
 * `npm run lint:dark-patterns` and CI on every commit from Phase 10
 * onward, mirroring scripts/check-no-referral-gating.mjs.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "actions"];
const SCAN_EXTENSIONS = [".ts", ".tsx"];

const RULES = [
  {
    id: "false-scarcity",
    description:
      "No false scarcity/urgency copy (golden rule #3): nothing here is a limited real-world resource",
    pattern:
      /\bonly\s+\d+\s+(left|seats?|rooms?|spots?)\b|\bhurry\b|\bexpires?\s+soon\b|\blimited\s+time\b|\bact\s+now\b|\bdon'?t\s+miss\s+out\b/i,
  },
];

export function checkContent(content, relPath) {
  const violations = [];
  for (const rule of RULES) {
    if (rule.pattern.test(content)) {
      violations.push({ file: relPath, rule: rule.id, detail: rule.description });
    }
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
      if (entry === "node_modules") continue;
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
    console.error("✖ Dark-pattern violations found:\n");
    for (const violation of violations) {
      console.error(`  ${violation.file} [${violation.rule}] ${violation.detail}`);
    }
    process.exit(1);
  }
  console.log("✓ No dark patterns found.");
}
