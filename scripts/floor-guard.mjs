#!/usr/bin/env node
// floor-guard.mjs — diff-scoped enforcement of the CONSTRAINTS.md floor.
// Adapted from the constraint-driven-development skill's reference implementation.
// Usage: node scripts/floor-guard.mjs [--base <ref>]   (default base: main)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const i = process.argv.indexOf("--base");
const base = i > -1 ? process.argv[i + 1] : "main";

// `git diff --no-index` exits 1 whenever files differ, which is the normal case here.
// A bare `catch { return null }` would therefore silently skip every untracked file —
// which is exactly the new-code case the guard most needs to see.
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
  console.error(`floor-guard: no merge base against ${base}`);
  process.exit(2);
}

const tracked = git(["diff", "--unified=0", mergeBase, "--"]) ?? "";
const untracked = (git(["ls-files", "--others", "--exclude-standard"]) ?? "")
  .split("\n")
  .filter(Boolean)
  .map((f) => git(["diff", "--no-index", "--unified=0", "/dev/null", f]) ?? "")
  .join("\n");
const diff = tracked + "\n" + untracked;

const added = [];
const removed = [];
let file = "";
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ ")) file = line.slice(6).replace(/^b\//, "");
  else if (line.startsWith("+") && !line.startsWith("+++")) added.push({ file, text: line.slice(1) });
  else if (line.startsWith("-") && !line.startsWith("---")) removed.push({ file, text: line.slice(1) });
}

const findings = [];
const flag = (rule, f, text) => findings.push({ rule, file: f, text: text.trim().slice(0, 120) });

const SUPPRESSIONS = /@ts-ignore|@ts-nocheck|@ts-expect-error|eslint-disable|biome-ignore|istanbul ignore|\bv8 ignore\b|nosemgrep|gitleaks:allow/;
const STUBS = /throw new (Error|NotImplemented)\b.*[Nn]ot implemented|\bTODO\b|\bFIXME\b|catch\s*\(\s*\w*\s*\)\s*\{\s*\}|catch\s*\{\s*\}/;
const SKIPS = /\b(it|test|describe)\.(skip|todo)\b|\b(xit|xdescribe)\s*\(/;

const IGNORED_PATHS = /(^|\/)(CONSTRAINTS\.md|graft\/|node_modules\/|\.next\/|coverage\/|package-lock\.json|AGENTS\.md)$/;

// `.constraintsignore` — one glob per line, so an exemption is a tracked file
// rather than a loosened rule.
const ignoreGlobs = (() => {
  const path = join(process.cwd(), ".constraintsignore");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => new RegExp("^" + l.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$"));
})();
const ignored = (f) => IGNORED_PATHS.test(f) || ignoreGlobs.some((re) => re.test(f));

for (const { file, text } of added) {
  if (ignored(file)) continue;
  if (SUPPRESSIONS.test(text)) flag("silenced-checker", file, text);
  if (STUBS.test(text)) flag("unfinished-work", file, text);
  if (SKIPS.test(text)) flag("test-made-easier", file, text);
  if (/CONSTRAINTS\.md$/.test(file) && /^\| *(W|E)\d+ *\|/.test(text)) flag("new-exception", file, text);
}

// Assertion migrations are reviewed individually. A record can only exempt its
// exact removed line when all declared replacement lines exist in the same diff.
const replacementPath = join(process.cwd(), ".constraint-assertion-replacements.json");
let replacements = [];
if (existsSync(replacementPath)) {
  try {
    replacements = JSON.parse(readFileSync(replacementPath, "utf8"));
    if (!Array.isArray(replacements) || replacements.some((entry) =>
      !entry || ["id", "file", "removed", "replacement", "reason", "owner"].some((key) => typeof entry[key] !== "string" || !entry[key].trim()) ||
      !Number.isInteger(entry.count) || entry.count < 1 ||
      typeof entry.expires !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires) || !Number.isFinite(Date.parse(entry.expires)))) {
      throw new Error("expected exact assertion replacements with a reason, owner, expiry, and positive count");
    }
  } catch (err) {
    console.error(`floor-guard: invalid assertion replacement registry: ${err.message}`);
    process.exit(2);
  }
}
const today = new Date().toISOString().slice(0, 10);
const acceptedReplacements = new Map();
const usedReplacementLines = new Map();
for (const entry of replacements) {
  const oldLines = removed.filter((line) => line.file === entry.file && line.text.trim() === entry.removed);
  if (!oldLines.length) continue;
  const newLines = added.filter((line) => line.file === entry.file && line.text.trim() === entry.replacement);
  const replacementKey = `${entry.file}\n${entry.replacement}`;
  const used = usedReplacementLines.get(replacementKey) ?? 0;
  if (entry.expires < today || oldLines.length !== entry.count || newLines.length - used < entry.count) continue;
  usedReplacementLines.set(replacementKey, used + entry.count);
  acceptedReplacements.set(`${entry.file}\n${entry.removed}`, entry);
}

for (const { file, text } of removed) {
  if (/(test|spec)\.[jt]sx?$/.test(file) && /\b(expect|assert|should)\b/.test(text)) {
    if (!acceptedReplacements.has(`${file}\n${text.trim()}`)) flag("assertion-removed", file, text);
  }
}

const nums = (s) => (s.match(/\d+(\.\d+)?/g) || []).map(Number);
const removedConstraints = removed.filter((l) => /CONSTRAINTS\.md$/.test(l.file));
const addedConstraints = added.filter((l) => /CONSTRAINTS\.md$/.test(l.file));
for (const r of removedConstraints) {
  const a = addedConstraints.find((x) => x.text.split(/[|:]/)[0] === r.text.split(/[|:]/)[0]);
  if (a && nums(a.text).some((n, idx) => nums(r.text)[idx] !== undefined && n < nums(r.text)[idx])) {
    flag("threshold-lowered", r.file, `${r.text}  ->  ${a.text}`);
  }
}

if (findings.length === 0) {
  for (const entry of acceptedReplacements.values()) console.log(`floor-guard: tracked assertion replacement ${entry.id} (${entry.count} line(s), owner ${entry.owner}, expires ${entry.expires})`);
  console.log("floor-guard: clean");
  process.exit(0);
}
console.error(`floor-guard: ${findings.length} floor violation(s):`);
for (const f of findings) console.error(`  [${f.rule}] ${f.file}: ${f.text}`);
console.error("\nEach is a move that lowers the bar. Fix the code, or route it through a tracked exception.");
process.exit(1);