# Constraints

Last reviewed: 2026-10-11

This file is the canonical source for the quality bar. `package.json` scripts are
convenience wrappers that mirror it — if they drift, this file wins.

## Floor (always enforced, no setup required)

- No new suppression comments: `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `eslint-disable`, `biome-ignore`
- No coverage-stripping comments: `istanbul ignore`, `v8 ignore`
- No security-finding escapes: `nosemgrep`, `gitleaks:allow`
- No unimplemented stubs: `throw new Error("Not implemented")`, empty `catch {}`, `TODO`/`FIXME` standing in for an implementation
- No skipped or deleted tests without a reason in the commit message
- No secrets in source
- This file does not get weakened to make a change pass

Enforced by `scripts/floor-guard.mjs`, which diff-scans against `main` for exactly
these five moves: threshold lowered, test made easier, checker silenced, work
unfinished, exception appeared. Tightening is silent; loosening is loud.

## Enforced with numbers

| Dimension | Rule | Checked by | Runs at |
|-----------|------|-----------|---------|
| Floor | Zero violations | `npm run check:floor` | every edit |
| Types | Zero type errors | `npm run typecheck` (`next typegen && tsc --noEmit`) | every edit |
| Lint | Zero errors and zero warnings | `npm run lint` (`eslint . --max-warnings=0`) | every edit |
| Secrets | No secrets in source | `npm run check:secrets` (`gitleaks detect --redact --no-banner`) | every edit |
| Coverage | Changed lines ≥ 80% | `npm run check:coverage` | task end, CI |
| Security: code | No high or critical findings | `npm run check:security` (`semgrep scan`) | task end, CI |
| Security: deps | Nothing at high or above | `npm run check:deps` (`osv-scanner` + baseline) | task end, CI |

Every row names the command that produces the verdict. A dimension with a number and
no command here is an aspiration, not a constraint.

Run them as `npm run check:fast` (floor, types, lint, secrets) after every edit and
`npm run check:task` (all of the above plus coverage and both security scans) before
handing work back.

### Why these numbers

- **80% changed-line coverage** — high enough to force a test for real logic, low
  enough to admit a config line or a type guard without demanding a test for it.
- **Zero lint warnings, not zero errors** — `eslint-config-next` emits warnings that
  are trivially ignorable in review. `--max-warnings=0` makes them blocking.
- **No high/critical Semgrep findings** — below high the signal is mostly style noise
  that trains the team to ignore the scanner.
- **No dependency at high or above** — same reasoning; moderate advisories are usually
  not exploitable here and would go stale between scans.
- **Floor guard is diff-scoped** — it reads the merge-base diff, so it stays under a
  second and never blocks on pre-existing debt it did not introduce.

## Measured, not yet enforced

| Metric | Today | Direction |
|--------|-------|-----------|
| Statement coverage (`lib`, `app`, `components`) | 80.81% | must not fall |
| Branch coverage (`lib`, `app`, `components`) | 73.04% | must not fall |
| `app/notation-spike/page.tsx` coverage | 0% | must not fall |

Measured 2026-10-11 with `npm run coverage`. Ratchet tolerance is 0.5% — a drop larger
than that is a finding, not noise. Update these numbers when one improves. A drop is
the finding; do not edit the number to hide it.

## Dependency advisory baseline

`security/deps-baseline.json` is a reviewed allowlist of accepted high/critical
advisories. It can only shrink: fix the dependency, delete the entry. An advisory past
its expiry blocks even when it is accepted, so the entry cannot be forgotten.

## Deliberately not enforced

- **Accessibility (axe)** — needs a running URL; the app has no CI deploy target yet.
  Reintroduce against a preview deploy when one exists.
- **Performance budgets** — no representative build in CI to measure LCP/CLS against.
- **Architecture boundaries** — the codebase is small enough that `dependency-cruiser`
  would be ceremony. Revisit if `components` starts importing across feature folders.

## Exceptions

| ID | Rule | Path | Reason | Owner | Expires |
|----|------|------|--------|-------|---------|