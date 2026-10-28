import { z } from "zod";
import { getVibeLabels, progressionSchema, resolveProgression } from "@/lib/progression";
import { progressionCollectionSchema, type ProgressionCollection } from "@/lib/progression-session";

const snapshotFieldsSchema = z.object({
  vibeIds: z.array(z.string().min(1).max(64)).min(1).max(5),
  chords: progressionSchema.shape.chords,
  progressions: progressionCollectionSchema.optional(),
}).strict().refine(({ vibeIds, chords, progressions }) =>
  getVibeLabels(vibeIds) !== null && resolveProgression(chords) !== null && new Set(chords).size >= 2 &&
  (!progressions || (chords.length === progressions.original.chords.length &&
    chords.every((chord, index) => chord === progressions.original.chords[index]))),
);

const withProgressions = <T extends z.output<typeof snapshotFieldsSchema>>(snapshot: T) => ({
  ...snapshot,
  progressions: snapshot.progressions ?? progressionCollectionSchema.parse({
    original: { id: "original", label: "Original", chords: snapshot.chords }, variations: [],
  }),
});

export const snapshotSchema = snapshotFieldsSchema.transform(withProgressions);
export type SaveVibeSnapshot = {
  vibeIds: readonly string[];
  chords: readonly string[];
  progressions?: ProgressionCollection;
};

export const parseSnapshot = (value: unknown): z.output<typeof snapshotSchema> | null => {
  const parsed = snapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const savedVibeSchema = snapshotFieldsSchema.safeExtend({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  createdAt: z.iso.datetime(),
}).transform(withProgressions);

export type SavedVibe = z.infer<typeof savedVibeSchema>;
