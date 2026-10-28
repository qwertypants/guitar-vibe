import { z } from "zod";
import { vibeCatalog } from "@/lib/vibes";
import { progressionSchema, resolveProgression } from "@/lib/progression";

export const snapshotSchema = z.object({
  vibeIds: z.array(z.string().min(1).max(64)).min(1).max(5),
  chords: progressionSchema.shape.chords,
}).strict();

export function parseSnapshot(value: unknown): { vibeIds: string[]; chords: string[] } | null {
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success || parsed.data.vibeIds.length < 1 || parsed.data.vibeIds.length > 5) return null;
  const ids = new Set<string>();
  const facets = new Set<string>();
  for (const id of parsed.data.vibeIds) {
    const option = vibeCatalog.find((item) => item.id === id);
    if (!option || ids.has(id) || facets.has(option.facet)) return null;
    ids.add(id); facets.add(option.facet);
  }
  if (!resolveProgression(parsed.data.chords) || new Set(parsed.data.chords).size < 2) return null;
  return parsed.data;
}

export const savedVibeSchema = snapshotSchema.extend({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  createdAt: z.iso.datetime(),
}).refine((value) => parseSnapshot({ vibeIds: value.vibeIds, chords: value.chords }) !== null);

export type SavedVibe = z.infer<typeof savedVibeSchema>;
