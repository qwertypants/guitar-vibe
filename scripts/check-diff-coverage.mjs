#!/usr/bin/env node
// check-diff-coverage.mjs — gate on coverage of the lines this change touched.
//
// Coverage needs no second test run: this reads the report your suite already writes
// and intersects it with the merge-base diff. Running the suite twice just to get a
// number is the fastest way to make people hate coverage.
//
// Usage: node scripts/check-diff-coverage.mjs [--base <ref>] [--threshold <pct>]
// Exit: 0 pass, 1 below threshold, 2 could not run.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const base = arg("base", "main");
const threshold = Number(arg("threshold", "80"));
const SCOPE = /^(app|components|lib)\//;

// `git diff --no-index` exits 1 whenever files differ, which is the normal case here.
// A bare catch would silently skip every untracked file, so recover stdout instead.
const git = (args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    if (err && typeof err.stdout === "string" && err.stdout.length > 0) return err.stdout;
    return null;
  }
};

const mergeBase = git(["merge-base", base, "HEAD"])?.trim();
if (!mergeBase) {
  console.error(`check-diff-coverage: no merge base against ${base}`);
  process.exit(2);
}

// ---- Changed lines: added lines only, from tracked diff plus untracked files. ----
const changed = new Map(); // file -> Set(line)

/** Comments and blanks are not executable, so they never count against coverage. */
const isExecutable = (text) => {
  const t = text.trim();
  return t.length > 0 && !t.startsWith("//") && !t.startsWith("/*") && !t.startsWith("*");
};

const record = (file, line, text) => {
  if (!file || !SCOPE.test(file) || !/\.[jt]sx?$/.test(file) || /\.(test|spec)\.[jt]sx?$/.test(file)) return;
  if (!isExecutable(text)) return;
  if (!changed.has(file)) changed.set(file, new Set());
  changed.get(file).add(line);
};

for (const file of git(["diff", "--name-only", mergeBase, "--"])?.split("\n").filter(Boolean) ?? []) {
  const diff = git(["diff", "--unified=0", mergeBase, "--", file]) ?? "";
  let newLine = 0;
  for (const raw of diff.split("\n")) {
    const h = raw.match(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/);
    if (h) { newLine = Number(h[1]); continue; }
    if (raw.startsWith("+++") || raw.startsWith("---")) continue;
    if (raw.startsWith("+")) { record(file, newLine, raw.slice(1)); newLine++; }
    else if (raw.startsWith("-")) continue;
    else newLine++;
  }
}

for (const file of git(["ls-files", "--others", "--exclude-standard"])?.split("\n").filter(Boolean) ?? []) {
  readFileSync(file, "utf8").split("\n").forEach((text, idx) => record(file, idx + 1, text));
}

if (changed.size === 0) {
  console.log(`check-diff-coverage: no changed source lines against ${base} — nothing to gate.`);
  process.exit(0);
}

// ---- Run the suite once, writing the coverage report. ----
const reportsDir = mkdtempSync(join(tmpdir(), "diff-cov-"));
try {
  execFileSync(
    "npx",
    [
      "vitest", "run",
      "--coverage.enabled",
      "--coverage.provider=v8",
      "--coverage.reportsDirectory=" + reportsDir,
      "--coverage.reporter=json",
      "--silent",
    ],
    { stdio: "inherit", env: { ...process.env, FORCE_COLOR: "0" } },
  );
} catch (err) {
  console.error("check-diff-coverage: the test suite itself failed; fix that first.");
  rmSync(reportsDir, { recursive: true, force: true });
  process.exit(err?.status === 1 ? 1 : 2);
}

const reportPath = join(reportsDir, "coverage-final.json");
if (!existsSync(reportPath)) {
  console.error("check-diff-coverage: coverage-final.json was not written; cannot gate.");
  rmSync(reportsDir, { recursive: true, force: true });
  process.exit(2);
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
rmSync(reportsDir, { recursive: true, force: true });

// ---- Intersect. ----
// A changed line counts as covered when a *covered* statement's range contains it.
// Matching only the start line undercounts multi-line statements — a JSX element or a
// function body is one statement spanning many lines, and every line inside a covered
// statement did in fact execute.
const coveredRanges = (entry) => {
  const out = [];
  for (const [id, count] of Object.entries(entry.s ?? {})) {
    const loc = entry.statementMap[id];
    if (loc && count > 0) out.push([loc.start.line, loc.end.line]);
  }
  for (const [id, counts] of Object.entries(entry.b ?? {})) {
    const loc = entry.branchMap[id]?.loc;
    if (loc && counts.some((c) => c > 0)) out.push([loc.start.line, loc.end.line]);
  }
  return out;
};

let total = 0;
let covered = 0;
const gaps = [];

for (const [file, lines] of changed) {
  const abs = join(process.cwd(), file);
  const entry = report[abs] ?? Object.values(report).find((e) => e?.path?.endsWith(file));
  const hit = coveredRanges(entry ?? {});
  for (const line of [...lines].sort((a, b) => a - b)) {
    total++;
    if (hit.some(([from, to]) => line >= from && line <= to)) covered++;
    else gaps.push(`${file}:${line}`);
  }
}

const pct = total === 0 ? 100 : (covered / total) * 100;
console.log(`check-diff-coverage: ${covered}/${total} changed lines covered (${pct.toFixed(1)}%), threshold ${threshold}%`);

if (pct + 1e-9 < threshold) {
  console.error("\nUncovered changed lines:");
  for (const g of gaps.slice(0, 40)) console.error(`  ${g}`);
  if (gaps.length > 40) console.error(`  ...and ${gaps.length - 40} more`);
  console.error("\nAdd tests for the changed lines, or drop the change. See CONSTRAINTS.md.");
  process.exit(1);
}

process.exit(0);