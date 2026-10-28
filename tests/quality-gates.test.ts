import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

const guard = resolve("scripts/floor-guard.mjs");
const previous = "expect(button).toBeDisabled();";
const replacement = "expect(variationButton).toBeDisabled();";
const entry = {
  id: "renamed-control", file: "tests/control.test.ts", removed: previous,
  replacement, count: 1, reason: "The control name changed; the pending-state assertion stays exact.",
  owner: "quality-gate test", expires: "2999-12-31",
};

const cases: { name: string; registry?: unknown; before?: string; after: string; expected: number }[] = [
  { name: "unregistered assertion removal", registry: undefined, after: replacement, expected: 1 },
  { name: "exact reviewed assertion replacement", registry: [entry], after: replacement, expected: 0 },
  { name: "missing replacement assertion", registry: [entry], after: "", expected: 1 },
  { name: "replacement in another file", registry: [{ ...entry, file: "tests/other.test.ts" }], after: replacement, expected: 1 },
  { name: "expired replacement", registry: [{ ...entry, expires: "2000-01-01" }], after: replacement, expected: 1 },
  { name: "incorrect replacement count", registry: [{ ...entry, count: 2 }], after: replacement, expected: 1 },
  { name: "missing replacement reason", registry: [{ ...entry, reason: "" }], after: replacement, expected: 2 },
  { name: "invalid replacement registry", registry: {}, after: replacement, expected: 2 },
  { name: "additional unregistered removal", registry: [entry], before: `${previous}\nexpect(otherButton).toBeEnabled();`, after: replacement, expected: 1 },
  { name: "a replacement cannot cover two different removals", registry: [entry, { ...entry, id: "other-control", removed: "expect(otherButton).toBeDisabled();" }], before: `${previous}\nexpect(otherButton).toBeDisabled();`, after: replacement, expected: 1 },
  ...[
    'console.log("coverage removed");',
    `console.log(${JSON.stringify(replacement)});`,
    `// ${replacement}`,
    `${JSON.stringify(replacement)};`,
    `() => ${replacement}`,
    `false && ${replacement}`,
    "expect(variationButton).toBeTruthy();",
    `if (false) { ${replacement} }`,
  ].map((after) => ({ name: `non-equivalent replacement ${after}`, registry: [{ ...entry, replacement: after }], before: previous, after, expected: 1 })),
  { name: "removed negation", registry: [{ ...entry, removed: "expect(button).not.toBeDisabled();" }], before: "expect(button).not.toBeDisabled();", after: replacement, expected: 1 },
];

test.each(cases)("floor guard enforces $name", ({ registry, before = previous, after, expected }) => {
  const cwd = mkdtempSync(join(tmpdir(), "guitar-vibe-floor-"));
  try {
    mkdirSync(join(cwd, "tests"));
    writeFileSync(join(cwd, "tests/control.test.ts"), `${before}\n`);
    execFileSync("git", ["init"], { cwd, stdio: "ignore" });
    execFileSync("git", ["symbolic-ref", "HEAD", "refs/heads/main"], { cwd });
    execFileSync("git", ["add", "tests/control.test.ts"], { cwd });
    execFileSync("git", ["-c", "user.name=Quality gate test", "-c", "user.email=quality@example.test", "commit", "-m", "Baseline assertion"], { cwd, stdio: "ignore" });
    writeFileSync(join(cwd, "tests/control.test.ts"), `${after}\n`);
    if (registry !== undefined) writeFileSync(join(cwd, ".constraint-assertion-replacements.json"), JSON.stringify(registry));
    const result = spawnSync(process.execPath, [guard], { cwd, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(expected);
    if (expected === 1) expect(result.stderr).toContain("[assertion-removed]");
    if (expected === 0) {
      expect(result.stdout).toContain("tracked assertion replacement renamed-control (1 line(s)");
      expect(result.stdout).toContain("[assertion-migration-review]");
      expect(result.stdout).toContain(`removed: ${previous}`);
      expect(result.stdout).toContain(`replacement: ${replacement}`);
      expect(result.stdout).toContain(entry.reason);
      expect(result.stdout).toContain("requires review");
    }
    if (expected === 2) expect(result.stderr).toContain("invalid assertion replacement registry");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
