import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getBuiltinVariation, getGenerationContext, generationRequestSchema } from "@/lib/progression-variation";
import { createProgressionSession, beginProgressionVariation, completeProgressionVariation, failProgressionVariation, type VariationDirection } from "@/lib/progression-session";
import { resolveProgression } from "@/lib/progression";
import { assessProgressionHarmony } from "@/lib/harmony";
import { vibeCatalog } from "@/lib/vibes";
import { VARIATION_MODES } from "@/lib/variation";

const originalChords = ["C", "F", "G"];
const context = { vibeIds: ["mood-warm", "genre-folk", "energy-gentle"], variation: "richer", exploration: { originalChords, direction: { kind: "mood", moodId: "mood-dark" } } } satisfies Parameters<typeof getGenerationContext>[0];
beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

test("guided generation changes only the mood and preserves original chord context", () => {
  expect(getGenerationContext(context)).toEqual({ ...context, vibeIds: ["genre-folk", "energy-gentle", "mood-dark"] });
  expect(context.vibeIds).toEqual(["mood-warm", "genre-folk", "energy-gentle"]);
  expect(getGenerationContext({ vibeIds: ["mood-warm"] })).toEqual({ vibeIds: ["mood-warm"], variation: "familiar" });
  vi.spyOn(Math, "random").mockReturnValue(0);
  expect(getGenerationContext({ ...context, exploration: { originalChords, direction: { kind: "surprise" } } })).toMatchObject({ vibeIds: ["genre-folk", "energy-gentle", "mood-moody"], variation: "familiar" });
});

test("all guided moods and richness modes generate coherent alternatives anchored to the original", () => {
  for (const mood of vibeCatalog.filter((vibe) => vibe.facet === "mood")) {
    for (const variation of VARIATION_MODES) {
      for (const genre of ["genre-folk", "genre-jazz", "genre-blues"]) {
        const request = getGenerationContext({ ...context, vibeIds: [genre], variation, exploration: { originalChords, direction: { kind: "mood", moodId: mood.id } } });
        const labels = request.vibeIds.map((id) => { const vibe = vibeCatalog.find((vibe) => vibe.id === id)!; return `${vibe.facet}: ${vibe.label}`; });
        const chords = getBuiltinVariation(labels, variation, originalChords);
        expect(chords).not.toEqual(originalChords);
        expect(resolveProgression(chords)).not.toBeNull();
        expect(assessProgressionHarmony(chords, genre === "genre-blues").coherent).toBe(true);
      }
    }
  }
  expect(getBuiltinVariation(["mood: Warm"], "familiar", originalChords)).toEqual(["F", "G", "C"]);
});

test.each([
  { originalChords: ["C", "C", "C"], direction: { kind: "surprise" } },
  { originalChords: ["C", "F", "unknown"], direction: { kind: "surprise" } },
  { originalChords, direction: { kind: "mood", moodId: "genre-jazz" } },
  { originalChords, direction: { kind: "other" } },
  { originalChords, direction: { kind: "surprise", prompt: "untrusted" } },
])("rejects invalid exploration %j", (exploration) => {
  expect(generationRequestSchema.safeParse({ vibeIds: ["mood-warm"], exploration }).success).toBe(false);
});

test.each(["server", "pages"])("%s handles repeated guided and surprise requests with failure-safe session state", async (mode) => {
  vi.stubEnv("NEXT_PUBLIC_APP_MODE", mode);
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ chords: resolveProgression(["Am", "F", "C"]) }));
  const { vibeService } = await import("@/lib/client/vibe-service");
  let session = createProgressionSession({ vibeIds: context.vibeIds, chords: originalChords, variation: "richer" });
  const original = session.progressions.original;
  const directions: VariationDirection[] = [{ kind: "mood", moodId: "mood-dark" }, { kind: "surprise" }, { kind: "mood", moodId: "mood-peaceful" }];
  for (const direction of directions) {
    session = beginProgressionVariation(session, direction);
    const result = await vibeService.generate({ vibeIds: [...session.vibeIds], variation: session.variation, exploration: { originalChords, direction } });
    session = completeProgressionVariation(session, result.chords.map((chord) => chord.symbol));
  }
  const previous = session.progressions;
  session = beginProgressionVariation(session, { kind: "surprise" });
  if (mode === "server") fetch.mockRejectedValueOnce(new Error("Network failed"));
  try {
    await vibeService.generate({ vibeIds: mode === "pages" ? ["unknown"] : [...session.vibeIds], exploration: { originalChords, direction: { kind: "surprise" } } });
  } catch (cause) {
    session = failProgressionVariation(session, cause instanceof Error ? cause.message : "Generation failed");
  }
  expect(session.generation.kind).toBe("error");
  expect(session.progressions).toBe(previous);
  expect(session.progressions.original).toBe(original);
  expect(session.progressions.variations.map(({ label }) => label)).toEqual(["Variation 1 · Dark", "Variation 2 · Surprise", "Variation 3 · Peaceful"]);
  if (mode === "pages") expect(fetch).not.toHaveBeenCalled();
  else expect(fetch).toHaveBeenCalledTimes(4);
});

test("server rejects malformed, unplayable, repeated-original and provider-error responses", async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_MODE", "server");
  const fetch = vi.spyOn(globalThis, "fetch");
  const { vibeService } = await import("@/lib/client/vibe-service");
  for (const payload of [{}, { chords: [{ symbol: "C" }] }, { chords: [{ symbol: "unknown" }, { symbol: "F" }, { symbol: "G" }] }, { chords: resolveProgression(originalChords) }, { chords: resolveProgression(["C", "C", "C"]) }]) {
    fetch.mockResolvedValueOnce(Response.json(payload));
    await expect(vibeService.generate(context)).rejects.toThrow();
  }
  fetch.mockResolvedValueOnce(Response.json({ error: "Please try later" }, { status: 503 }));
  await expect(vibeService.generate(context)).rejects.toThrow("Please try later");
  fetch.mockResolvedValueOnce(Response.json({ unexpected: true }, { status: 503 }));
  await expect(vibeService.generate(context)).rejects.toThrow("This request could not be completed");
});

test("Pages rejects damaged built-in output and recovers without calling the network", async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_MODE", "pages");
  const fetch = vi.spyOn(globalThis, "fetch");
  const builtin = await import("@/lib/builtin-progression");
  const { vibeService } = await import("@/lib/client/vibe-service");
  const rules = vi.spyOn(builtin, "getFallbackProgression").mockReturnValueOnce(["unknown", "F", "G"]);
  await expect(vibeService.generate(context)).rejects.toThrow("This progression could not be played.");
  rules.mockImplementationOnce(() => { throw new Error("Rules unavailable"); });
  await expect(vibeService.generate(context)).rejects.toThrow("Rules unavailable");
  const result = await vibeService.generate(context);
  expect(result.chords.every((chord) => chord.voicings.length > 0)).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});
