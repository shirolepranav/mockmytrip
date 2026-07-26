#!/usr/bin/env node
/*
 * Referral-gating guard (Phase 9 task 11, golden rule #8): "invite N
 * friends to unlock…" and its variants are banned outright — sharing must
 * never be a growth mechanic. Scans source for copy that gates any
 * feature/content behind inviting, referring, or sharing. Exits 1 with a
 * report when a match is found. Used by `npm run lint:ethics` and CI on
 * every commit from Phase 9 onward, mirroring scripts/check-banned-styles.mjs.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "actions"];
const SCAN_EXTENSIONS = [".ts", ".tsx"];

const RULES = [
  {
    id: "referral-gating",
    description:
      "Sharing/inviting/referring must never gate a feature or reward (golden rule #8)",
    pattern:
      /invite[^.\n]{0,60}\b(unlock|to earn|to get|for access)\b|refer\s+a\s+friend|invite\s+\d+\s+friends?|share[^.\n]{0,40}\bunlock\b/i,
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
    console.error("✖ Referral-gating violations found:\n");
    for (const violation of violations) {
      console.error(`  ${violation.file} [${violation.rule}] ${violation.detail}`);
    }
    process.exit(1);
  }
  console.log("✓ No referral gating found.");
}
