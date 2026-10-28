import { describe, expect, it } from "vitest";
import {
  beginProgressionVariation, completeProgressionVariation, createProgressionSession,
  failProgressionVariation, progressionCollectionSchema, progressionSessionSchema, variationDirectionSchema,
} from "@/lib/progression-session";

const createSession = () => createProgressionSession({ vibeIds: ["genre-folk"], chords: ["C", "F", "G"] });
const surprise = { kind: "surprise" } as const;

describe("progression exploration sessions", () => {
  it("initializes an immutable original and snapshots its input", () => {
    const chords = ["C", "F", "G"];
    const vibeIds = ["genre-folk"];
    const session = createProgressionSession({ vibeIds, chords });
    chords[0] = "Am";
    vibeIds[0] = "genre-pop";
    expect(session).toEqual({
      vibeIds: ["genre-folk"], variation: "familiar",
      progressions: { original: { id: "original", label: "Original", chords: ["C", "F", "G"] }, variations: [] },
      generation: { kind: "idle" },
    });
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.progressions.original)).toBe(true);
    expect(Object.isFrozen(session.progressions.original.chords)).toBe(true);
    expect(Object.isFrozen(session.progressions.variations)).toBe(true);
  });

  it("appends exactly one labeled variation per completed request and retains previous identities", () => {
    const original = createSession();
    const pending = beginProgressionVariation(original, { kind: "mood", moodId: "mood-dreamy" });
    expect(pending.progressions).toBe(original.progressions);
    expect(beginProgressionVariation(pending, surprise)).toBe(pending);
    const chords = ["Am", "F", "G"];
    const first = completeProgressionVariation(pending, chords);
    chords[0] = "Dm";
    expect(first.progressions.variations).toEqual([{
      id: "variation-1", label: "Variation 1 · Dreamy", direction: { kind: "mood", moodId: "mood-dreamy" },
      chords: ["Am", "F", "G"],
    }]);
    expect(completeProgressionVariation(first, ["Dm", "F", "G"])).toBe(first);
    const second = completeProgressionVariation(beginProgressionVariation(first, surprise), ["Am", "F", "G"]);
    const third = completeProgressionVariation(beginProgressionVariation(second, surprise), ["Am", "F", "G"]);
    expect(third.progressions.variations.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "variation-1", label: "Variation 1 · Dreamy" },
      { id: "variation-2", label: "Variation 2 · Surprise" },
      { id: "variation-3", label: "Variation 3 · Surprise" },
    ]);
    expect(third.progressions.original).toBe(original.progressions.original);
    expect(third.progressions.variations[0]).toBe(first.progressions.variations[0]);
    expect(first.progressions.variations).toHaveLength(1);
    expect(original.progressions.variations).toEqual([]);
    expect(progressionSessionSchema.safeParse(third).success).toBe(true);
  });

  it("preserves all choices on failure, invalid responses, and retry", () => {
    const saved = completeProgressionVariation(beginProgressionVariation(createSession(), surprise), ["Am", "F", "G"]);
    expect(failProgressionVariation(saved, "ignored")).toBe(saved);
    const pending = beginProgressionVariation(saved, surprise);
    const failed = failProgressionVariation(pending, "Generation failed");
    expect(failed.generation).toEqual({ kind: "error", message: "Generation failed" });
    expect(failed.progressions).toBe(saved.progressions);
    expect(completeProgressionVariation(failed, ["Dm", "G", "C"])).toBe(failed);
    for (const chords of [["C", "F"], ["C", "C", "C"], ["C", "F", "nonsense"]]) {
      const invalid = completeProgressionVariation(beginProgressionVariation(failed, surprise), chords);
      expect(invalid.generation.kind).toBe("error");
      expect(invalid.progressions).toBe(saved.progressions);
    }
    const retry = completeProgressionVariation(beginProgressionVariation(failed, surprise), ["Dm", "G", "C"]);
    expect(retry.progressions.variations[1]?.id).toBe("variation-2");
  });

  it("rejects invalid metadata, original progressions, and ordered identities", () => {
    expect(() => createProgressionSession({ vibeIds: ["unknown"], chords: ["C", "F", "G"] })).toThrow();
    expect(() => createProgressionSession({ vibeIds: ["genre-folk", "genre-pop"], chords: ["C", "F", "G"] })).toThrow();
    expect(() => createProgressionSession({ vibeIds: ["genre-folk"], chords: ["C", "F", "unknown"] })).toThrow();
    expect(variationDirectionSchema.safeParse({ kind: "mood", moodId: "genre-folk" }).success).toBe(false);
    expect(variationDirectionSchema.safeParse({ kind: "surprise", moodId: "mood-dark" }).success).toBe(false);
    const session = completeProgressionVariation(beginProgressionVariation(createSession(), surprise), ["Am", "F", "G"]);
    const entry = session.progressions.variations[0];
    expect(progressionCollectionSchema.safeParse({ ...session.progressions, variations: [entry, entry] }).success).toBe(false);
    expect(progressionCollectionSchema.safeParse({ ...session.progressions, variations: [{ ...entry, label: "Changed" }] }).success).toBe(false);
    expect(progressionCollectionSchema.safeParse({ ...session.progressions, original: { ...session.progressions.original, id: "variation-1" } }).success).toBe(false);
  });
});
