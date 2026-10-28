import { assessProgressionHarmony } from "@/lib/harmony";
import { progressionSchema, resolveProgression } from "@/lib/progression";
import type { VariationMode } from "@/lib/variation";

export function hasSpanishInfluence(labels: readonly string[]): boolean {
  return labels.some((label) => ["genre: Flamenco", "genre: Spanish guitar", "setting: Seville courtyard",
    "setting: Granada twilight", "setting: Flamenco tablao"].includes(label));
}

export function getFallbackProgression(labels: readonly string[], variation: VariationMode): string[] {
  const isBlues = labels.includes("genre: Blues");
  const isJazz = labels.some((label) => label === "genre: Jazz" || label === "genre: Neo-soul");
  const isMinor = labels.some((label) => label === "mood: Melancholy" || label === "mood: Dark");
  const chords = hasSpanishInfluence(labels)
    ? variation === "richer" ? ["Am", "G", "Fmaj7", "E7"]
      : variation === "adventurous" ? ["Dm", "Am", "G", "F", "E"] : ["Am", "G", "F", "E"]
    : isBlues ? ["E7", "A7", "B7"]
    : isJazz && isMinor ? ["Am7", "Dm7", "G7", "Cmaj7"]
      : isJazz ? ["Cmaj7", "Am7", "Fmaj7", "G7"]
        : isMinor && variation === "richer" ? ["Am7", "Dm7", "E7", "Am7"]
          : isMinor && variation === "adventurous" ? ["Am", "Dsus4", "E7", "Am"]
            : isMinor ? ["Am", "F", "G"]
              : variation === "richer" ? ["Cmaj7", "Am7", "Fmaj7", "G7"]
                : variation === "adventurous" ? ["C", "Am", "Dsus4", "G"]
                  : ["C", "F", "G"];
  const parsed = progressionSchema.safeParse({ chords });
  const resolved = parsed.success ? resolveProgression(parsed.data.chords) : null;
  const harmony = assessProgressionHarmony(chords, isBlues);
  if (!parsed.success || !resolved || resolved.some((card, index) => card.symbol !== chords[index] || card.voicings.length === 0) ||
    new Set(chords).size < 2 || !harmony.coherent) {
    throw new Error("Configured fallback progression failed validation.");
  }
  return chords;
}
