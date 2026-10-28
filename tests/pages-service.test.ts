import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getFallbackProgression } from "@/lib/builtin-progression";
import { assessProgressionHarmony } from "@/lib/harmony";
import { vibeCatalog } from "@/lib/vibes";
import { VARIATION_MODES } from "@/lib/variation";

beforeEach(() => { vi.resetModules(); vi.stubEnv("NEXT_PUBLIC_APP_MODE", "pages"); localStorage.clear(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

test("every catalog vibe and variation generates playable coherent chords without network requests", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const { vibeService, isPagesMode } = await import("@/lib/client/vibe-service");
  expect(isPagesMode).toBe(true);
  for (const vibe of vibeCatalog) {
    for (const variation of VARIATION_MODES) {
      const result = await vibeService.generate({ vibeIds: [vibe.id], variation });
      expect(result.chords.length).toBeGreaterThanOrEqual(3);
      expect(result.chords.length).toBeLessThanOrEqual(6);
      expect(result.chords.every(({ voicings }) => voicings.length > 0 && voicings.every(({ midiNotes }) => midiNotes.length > 0))).toBe(true);
      expect(assessProgressionHarmony(result.chords.map(({ symbol }) => symbol), vibe.label === "Blues").coherent).toBe(true);
      expect(result.fallbackUsed).toBe(false);
    }
  }
  expect(fetch).not.toHaveBeenCalled();
});

test("keeps the established familiar, richer, adventurous and Spanish rules", async () => {
  const { vibeService } = await import("@/lib/client/vibe-service");
  const generate = async (vibeIds: string[], variation: "familiar" | "richer" | "adventurous") =>
    (await vibeService.generate({ vibeIds, variation })).chords.map(({ symbol }) => symbol);
  expect(await generate(["mood-dreamy"], "familiar")).toEqual(["C", "F", "G"]);
  expect(await generate(["mood-dreamy"], "richer")).toEqual(["Cmaj7", "Am7", "Fmaj7", "G7"]);
  expect(await generate(["mood-dreamy"], "adventurous")).toEqual(["C", "Am", "Dsus4", "G"]);
  expect(getFallbackProgression(["genre: Flamenco"], "familiar")).toEqual(["Am", "G", "F", "E"]);
  expect(getFallbackProgression(["genre: Flamenco"], "richer")).toEqual(["Am", "G", "Fmaj7", "E7"]);
  expect(getFallbackProgression(["genre: Flamenco"], "adventurous")).toEqual(["Dm", "Am", "G", "F", "E"]);
});

test("uses browser persistence and rejects unknown, duplicate or empty selections", async () => {
  const { vibeService } = await import("@/lib/client/vibe-service");
  for (const vibeIds of [[], ["unknown"], ["mood-dreamy", "mood-moody"], ["mood-dreamy", "mood-dreamy"]]) {
    await expect(vibeService.generate({ vibeIds })).rejects.toThrow();
  }
  await vibeService.save({ vibeIds: ["mood-dreamy"], chords: ["C", "F", "G"] });
  expect(await vibeService.list()).toHaveLength(1);
  await vibeService.delete(1);
  expect(await vibeService.list()).toEqual([]);
});


test.each(["pages", "server"])("%s service saves collections and normalizes legacy list records", async (mode) => {
  vi.stubEnv("NEXT_PUBLIC_APP_MODE", mode);
  const legacy = { id: 1, createdAt: "2026-10-28T12:00:00Z", vibeIds: ["mood-dreamy"], chords: ["C", "F", "G"] };
  const { createProgressionSession, beginProgressionVariation, completeProgressionVariation } = await import("@/lib/progression-session");
  let session = createProgressionSession(legacy);
  session = completeProgressionVariation(beginProgressionVariation(session, { kind: "mood", moodId: "mood-dreamy" }), ["Am", "F", "C"]);
  session = completeProgressionVariation(beginProgressionVariation(session, { kind: "surprise" }), ["Dm", "G", "C"]);
  const snapshot = { vibeIds: session.vibeIds, chords: session.progressions.original.chords, progressions: session.progressions };
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ vibes: [legacy] }));
  const { BROWSER_VIBES_KEY } = await import("@/lib/browser-vibes-store");
  localStorage.setItem(BROWSER_VIBES_KEY, JSON.stringify({ nextId: 2, vibes: [legacy] }));
  const { vibeService } = await import("@/lib/client/vibe-service");
  expect((await vibeService.list())[0]?.progressions.variations).toEqual([]);
  await vibeService.save(snapshot);
  if (mode === "pages") {
    expect((await vibeService.list())[0]?.progressions).toEqual(session.progressions);
    expect(fetch).not.toHaveBeenCalled();
  } else {
    expect(fetch).toHaveBeenLastCalledWith("/api/vibes", expect.objectContaining({ body: JSON.stringify(snapshot) }));
    fetch.mockResolvedValue(Response.json({ vibes: [{ ...legacy, ...snapshot }] }));
    expect((await vibeService.list())[0]?.progressions).toEqual(session.progressions);
  }
});
