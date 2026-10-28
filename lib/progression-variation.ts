import { z } from "zod";
import { getFallbackProgression } from "@/lib/builtin-progression";
import { assessProgressionHarmony } from "@/lib/harmony";
import { getVibeLabels, progressionRequestSchema, progressionSchema, resolveProgression } from "@/lib/progression";
import { variationDirectionSchema } from "@/lib/progression-session";
import { VARIATION_MODES } from "@/lib/variation";
import { vibeCatalog } from "@/lib/vibes";

export const variationBasisSchema = progressionSchema.shape.chords.refine(
  (chords) => resolveProgression(chords) !== null && new Set(chords).size >= 2,
);
export const generationRequestSchema = progressionRequestSchema.safeExtend({
  exploration: z.object({ originalChords: variationBasisSchema, direction: variationDirectionSchema }).strict().optional(),
}).refine(({ vibeIds }) => getVibeLabels(vibeIds) !== null);

export function getGenerationContext(input: z.input<typeof generationRequestSchema>) {
  const request = generationRequestSchema.parse(input);
  if (!request.exploration) return request;
  const direction = request.exploration.direction;
  const moods = vibeCatalog.filter((option) => option.facet === "mood" && !request.vibeIds.includes(option.id));
  const moodId = direction.kind === "mood" ? direction.moodId : moods[Math.floor(Math.random() * moods.length)]!.id;
  const vibeIds = [...request.vibeIds.filter((id) => !vibeCatalog.some((vibe) => vibe.id === id && vibe.facet === "mood")), moodId];
  const variation = direction.kind === "surprise" ? VARIATION_MODES[Math.floor(Math.random() * VARIATION_MODES.length)]! : request.variation;
  return { ...request, vibeIds, variation };
}

export function getBuiltinVariation(labels: readonly string[], variation: z.output<typeof progressionRequestSchema>["variation"], originalChords: readonly string[]) {
  const base = getFallbackProgression(labels, variation);
  // Keep the original cadence when it fits the requested mood's harmony.
  const anchored = [...base.slice(0, -1), originalChords[originalChords.length - 1]!];
  const chords = assessProgressionHarmony(anchored, labels.includes("genre: Blues")).coherent && new Set(anchored).size >= 2 ? anchored : base;
  return JSON.stringify(chords) === JSON.stringify(originalChords) ? [...chords.slice(1), chords[0]!] : chords;
}
