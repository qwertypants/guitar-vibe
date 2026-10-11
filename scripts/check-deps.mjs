#!/usr/bin/env node
// check-deps.mjs — dependency-advisory gate with a ratchet baseline.
//
// `osv-scanner scan` exits non-zero for ANY advisory, which makes it unusable as a
// blocking gate the moment an upstream package ships an unfixable advisory: the team
// learns to ignore a red build, and a red build nobody reads is worse than no build.
// So this wrapper keeps the raw scan blocking but subtracts a reviewed allowlist.
//
// The allowlist in security/deps-baseline.json is the point. It can only shrink:
// an advisory is accepted deliberately, with an owner and an expiry, and an entry past
// its expiry blocks anyway, so it cannot be quietly forgotten. Fix the dependency and
// delete the entry — that entry shrinking is the signal the bar moved back up.
//
// Usage: node scripts/check-deps.mjs
// Exit: 0 clean, 1 new or expired high-or-above advisory, 2 scanner could not run.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BLOCKING = new Set(["CRITICAL", "HIGH"]);
const baselinePath = join(process.cwd(), "security", "deps-baseline.json");

let baseline = { advisories: {} };
if (existsSync(baselinePath)) {
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  } catch (err) {
    console.error(`check-deps: security/deps-baseline.json is not valid JSON — ${err.message}`);
    process.exit(2);
  }
}

let raw;
try {
  raw = execFileSync("osv-scanner", ["scan", "source", "-r", ".", "--format", "json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  // osv-scanner exits non-zero when it finds anything. That is not a failure to run.
  raw = typeof err?.stdout === "string" ? err.stdout : "";
  if (!raw.trim()) {
    console.error("check-deps: osv-scanner produced no output.");
    if (err?.stderr) console.error(err.stderr.trim());
    process.exit(2);
  }
}

let report;
try {
  report = JSON.parse(raw);
} catch (err) {
  console.error(`check-deps: could not parse osv-scanner output — ${err.message}`);
  process.exit(2);
}

const findings = [];
for (const result of report.results ?? []) {
  for (const pkg of result.packages ?? []) {
    const info = pkg.package ?? {};
    for (const vuln of pkg.vulnerabilities ?? []) {
      findings.push({
        id: vuln.id,
        // osv-scanner v2 puts the severity label in database_specific, not at the top
        // level. Reading vuln.severity yields "" for everything and passes everything.
        severity: String(vuln.database_specific?.severity ?? vuln.severity ?? "").toUpperCase(),
        name: info.name ?? "unknown",
        version: info.version ?? "?",
        scope: Array.isArray(pkg.dependency_groups) ? pkg.dependency_groups.join(",") : "",
      });
    }
  }
}

const accepted = baseline.advisories ?? {};
const today = new Date().toISOString().slice(0, 10);

const blocking = [];
const expired = [];
const seen = new Set();
let blockingCount = 0;

for (const f of findings) {
  if (!BLOCKING.has(f.severity)) continue;
  blockingCount++;
  const entry = accepted[f.id];
  if (!entry) { blocking.push(f); continue; }
  seen.add(f.id);
  if (entry.expires && entry.expires < today) expired.push({ ...f, entry });
}

for (const [id, entry] of Object.entries(accepted)) {
  if (!seen.has(id) && entry.reason) {
    console.error(`check-deps: baseline entry ${id} is stale — that advisory is gone. Delete it so the bar tightens.`);
  }
}

if (expired.length) {
  console.error(`check-deps: ${expired.length} accepted advisory/ies past their expiry:`);
  for (const { id, name, entry } of expired) {
    console.error(`  ${id} (${name}) expired ${entry.expires} — owner ${entry.owner ?? "unassigned"}`);
  }
  console.error("Fix the dependency, or re-approve with a new expiry and a reason. Do not delete the entry silently.");
  process.exit(1);
}

if (blocking.length) {
  console.error(`check-deps: ${blocking.length} high-or-above advisory/ies not in the baseline:`);
  for (const f of blocking) {
    console.error(`  ${f.id} ${f.name}@${f.version} (${f.severity}${f.scope ? `, ${f.scope}` : ""})`);
  }
  console.error("\nFix it, or accept it deliberately by adding an entry to security/deps-baseline.json");
  console.error("with a reason, an owner, and an expiry. See CONSTRAINTS.md.");
  process.exit(1);
}

console.log(`check-deps: clean (${blockingCount} high/critical, all accepted).`);
process.exit(0);