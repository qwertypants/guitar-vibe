import { z } from "zod";
import { vibeCatalog } from "@/lib/vibes";
import { resolveChord, type ChordVoicing } from "@/lib/voicings";
import { variationModeSchema } from "@/lib/variation";

export const progressionRequestSchema = z.object({
  vibeIds: z.array(z.string().min(1).max(64)).min(1).max(5),
  variation: variationModeSchema.default("familiar"),
}).strict();

export const progressionSchema = z.object({
  chords: z.array(z.string().trim().min(1).max(16)).min(3).max(6),
}).strict();

export type ProgressionCard = {
  readonly symbol: string;
  readonly voicings: readonly ChordVoicing[];
};

export function resolveProgression(chords: readonly string[]): ProgressionCard[] | null {
  const result: ProgressionCard[] = [];
  for (const chord of chords) {
    const resolved = resolveChord(chord);
    if (resolved.kind === "unsupported") return null;
    result.push({ symbol: resolved.symbol, voicings: resolved.voicings });
  }
  return result;
}

export function getVibeLabels(vibeIds: readonly string[]): string[] | null {
  const seenIds = new Set<string>();
  const seenFacets = new Set<string>();
  const labels: string[] = [];
  for (const id of vibeIds) {
    const option = vibeCatalog.find((item) => item.id === id);
    if (!option || seenIds.has(id) || seenFacets.has(option.facet)) return null;
    seenIds.add(id);
    seenFacets.add(option.facet);
    labels.push(`${option.facet}: ${option.label}`);
  }
  return labels;
}
