---
name: progression-harness
description: Use when changing Guitar Vibe progression evaluation cases, holdouts, scoring gates, model benchmarks, or benchmark reports; use for interpreting automated proxy and performance results before claiming a model winner.
---

# Progression harness

Use this skill for work in `evals/cases.ts`, `evals/scoring.ts`, `evals/run.ts`, their tests, and benchmark output. Read the current source before changing rules or interpreting old result files. The implementation is authoritative; do not infer behavior from field names or prior reports.

## Corpus and holdouts

- Each `EvalCase` has an `id`, catalog `vibeIds`, proxy `expectations`, and `holdout` flag. Keep ids stable when preserving historical comparisons. Keep all vibe ids valid in the current catalog.
- Inspect both the case list and benchmark loop whenever adding or changing holdouts. In the current harness, `holdout` marks cases as combinations that are not prompt examples, but `runBenchmark` scores every member of `CASES`, and `aggregate` pools every scored row. The flag does not exclude cases or produce a separate holdout score. Do not call current results holdout-only or describe the holdout as isolated. If isolation or separate reporting is needed, implement and test it explicitly, then report which cases entered each aggregate.
- Expectations are mechanical proxies. Keep expected claims tied to what the scorer actually checks; cases with no expectations intentionally add no extra vibe claim.

## Validity, proxy, and eligibility

- A progression is valid only when it has 3–6 canonical supported chord symbols, every symbol resolves through `resolveProgression` to trusted/playable voicings, and it contains at least two distinct symbols. Do not equate model-schema acceptance with playable validity.
- Preserve the current eligibility gates unless the task explicitly changes them: 100% valid/playable scored responses, at least 80% proxy passes, and at least 3 distinct valid ordered progressions. Failed requests count against both rates; warmup phases are excluded from these gates.
- `proxyPass` means the current coherence heuristic and all case expectations pass. Coherence uses scale chord share (with the scorer's harmonic-minor cadence allowance) or the blues root relationship; expectation checks include minor, major opening, seventh, triads, and blues. Read `scoreProgression` before editing or summarizing these details.
- These are automated proxies, not human judgments of musical quality, style fit, or listenability. Preserve that distinction in code, charts, and prose. Encourage listening or human assessment as a separate source of evidence; never present proxy pass rate as a listening score.

## Model comparisons and reports

- Before comparing runs, verify comparable conditions: same case corpus and expectations, prompt template hash, run count and seeds, model IDs/tags, temperature/context/output settings, concurrency, Ollama version, hardware, and relevant residency/metadata. The benchmark records many of these; surface differences and missing metadata instead of assuming equivalence.
- Read `aggregate` and `chooseWinner` before describing the result. Currently `passes` requires at least one scored sample plus all three eligibility gates. `chooseWinner` considers only passing summaries, then selects lowest p50 scored wall time, breaking ties by lower loaded model bytes; otherwise `winner` is `null`. It does not rank quality among passing models. A winner is eligible only if the current run's gates pass; do not infer one from a partial table, a prior benchmark, or a single proxy metric.
- Report sample and failure counts, valid/playable rate, proxy pass rate, distinct progression count, and the applicable latency and size metrics. Explain that latency percentiles use scored requests including failures, while first request and discarded warmup are excluded. Include corpus/holdout handling and material run-condition differences.
- Keep benchmark scope and limitations visible: results apply to the tested shortlist and hardware; first request is not a cold-load measurement because the harness does not unload models; Ollama residency estimates are not process RSS or total system memory.

## Running and changing evaluations

Run the harness using the current package script, `npm run eval:models -- --models <comma-separated-IDs> --runs <positive-integer> --out <path>`. It calls the configured local model service and writes a benchmark artifact; confirm service/model availability and choose an intentional output path before running. Do not overwrite committed results without explicit task scope.

When changing scorer or corpus behavior, update focused tests to lock down eligibility, failed-sample denominators, holdout inclusion/isolation, and winner selection as applicable. Do not weaken gates to make a model pass. Follow repository constraints: `npm run check:fast` after each edit and `npm run check:task` before handoff.
