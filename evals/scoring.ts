import type { EvalCase } from "./cases";
import { CHORD_INTERVALS, SUPPORTED_CHORDS } from "../lib/chords";
import { progressionSchema, resolveProgression } from "../lib/progression";
export type Score = { valid: boolean; coherent: boolean; proxyPass: boolean; reasons: string[] };
export type Sample = { phase: "first-request" | "discarded-warmup" | "scored"; caseId: string; seed: number } & ({ kind: "accepted"; chords: string[]; metrics: { wallMs: number; loadMs: number; generationMs: number; promptTokens: number; outputTokens: number }; score: Score } | { kind: "failed"; error: string; wallMs: number });
export function scoreProgression(fixture: EvalCase, chords: readonly string[]): Score {
  const parsed = progressionSchema.safeParse({ chords });
  const resolved = parsed.success ? resolveProgression(parsed.data.chords) : null;
  const valid = resolved !== null && chords.length >= 3 && chords.length <= 8 && new Set(chords).size >= 2;
  if (!valid) return { valid: false, coherent: false, proxyPass: false, reasons: ["Requires 3-8 supported playable chords and at least two distinct chords."] };
  const catalog = chords.map(symbol => SUPPORTED_CHORDS.find(c => c.symbol === symbol));
  if (catalog.some(c => !c)) return {valid: false, coherent: false, proxyPass: false, reasons: ["Canonical catalog symbol required."]};
  const known = catalog.filter(c => c !== undefined);
  const blues = known.some(tonic => {
    const roots = [tonic.pitchClass, (tonic.pitchClass + 5) % 12, (tonic.pitchClass + 7) % 12];
    return known.every(c => c.suffix === "7" && roots.includes(c.pitchClass)) && roots.every(root => known.some(c => c.pitchClass === root));
  });
  const scaleShare = Math.max(...Array.from({length: 12}, (_, tonic) => {
    // Natural minor has the same pitch-class sets as relative major.
    const scale = [0, 2, 4, 5, 7, 9, 11].map(i => (i + tonic) % 12);
    return known.filter(c => CHORD_INTERVALS[c.suffix].every(i => scale.includes((i + c.pitchClass) % 12))).length / known.length;
  }));
  const coherent = fixture.expectations.includes("blues") ? blues : scaleShare >= 0.75;
  const reasons = [fixture.expectations.includes("blues") ? `Blues I-IV-V dominant relationship: ${blues}.` : `Common major/natural-minor scale chord share: ${scaleShare.toFixed(3)}; requires >=0.75.`];
  const expectations = fixture.expectations.map(expectation => {
    let pass: boolean;
    switch (expectation) {
      case "minor": pass = known.some(c => c.suffix === "m" || c.suffix === "m7"); break;
      case "major-opening": pass = known[0]?.suffix === "" || known[0]?.suffix === "maj7" || known[0]?.suffix === "7"; break;
      case "seventh": pass = known.some(c => c.suffix.includes("7")); break;
      case "triads": pass = known.filter(c => c.suffix === "" || c.suffix === "m").length / known.length >= 0.75; break;
      case "blues": pass = blues; break;
    }
    reasons.push(`${expectation}: ${pass}.`);
    return pass;
  });
  if (!expectations.length) reasons.push("No additional vibe claim for these vague settings/eras/energies.");
  return {valid, coherent, proxyPass: coherent && expectations.every(Boolean), reasons};
}
export function percentile(values: readonly number[], p: number): number | null {
  if (!(p > 0 && p <= 1)) throw new RangeError("Percentile must be >0 and <=1.");
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * p) - 1] ?? null;
}
export function aggregate(model: string, samples: readonly Sample[], loadedBytes: number | null) {
  const scored = samples.filter(s => s.phase === "scored");
  const accepted = scored.filter(s => s.kind === "accepted");
  const validRate = scored.length ? accepted.filter(s => s.score.valid).length / scored.length : 0;
  const proxyPassRate = scored.length ? accepted.filter(s => s.score.proxyPass).length / scored.length : 0;
  const distinctProgressions = new Set(accepted.filter(s => s.score.valid).map(s => JSON.stringify(s.chords))).size;
  const latencies = scored.map(s => s.kind === "accepted" ? s.metrics.wallMs : s.wallMs);
  const loadTimes = samples.filter(s => s.kind === "accepted").map(s => s.metrics.loadMs);
  return { model, loadedBytes, sampleCount: scored.length, failureCount: scored.length - accepted.length, validRate, proxyPassRate,
    distinctProgressions, passes: scored.length > 0 && validRate === 1 && proxyPassRate >= 0.8 && distinctProgressions >= 3,
    p50WarmWallMs: percentile(latencies, 0.5), p95WarmWallMs: percentile(latencies, 0.95), maximumLoadMs: loadTimes.length ? Math.max(...loadTimes) : null };
}
export function chooseWinner(summaries: readonly ReturnType<typeof aggregate>[]): string | null {
  return [...summaries].filter(s => s.passes).sort((a, b) => (a.p50WarmWallMs ?? Infinity) - (b.p50WarmWallMs ?? Infinity) || (a.loadedBytes ?? Infinity) - (b.loadedBytes ?? Infinity))[0]?.model ?? null;
}
