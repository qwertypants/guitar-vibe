import { z } from "zod";
import { getVibeLabels, progressionRequestSchema, progressionSchema, resolveProgression } from "@/lib/progression";
import { vibeCatalog } from "@/lib/vibes";

const playableChordsSchema = progressionSchema.shape.chords.refine(
  (chords) => resolveProgression(chords) !== null && new Set(chords).size >= 2,
  "Choose a playable progression with at least two different chords.",
).readonly();

export const variationDirectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("mood"),
    moodId: z.string().refine((id) => vibeCatalog.some((option) => option.id === id && option.facet === "mood")),
  }).strict().readonly(),
  z.object({ kind: z.literal("surprise") }).strict().readonly(),
]);
export type VariationDirection = z.infer<typeof variationDirectionSchema>;

const variationLabel = (index: number, direction: VariationDirection): string => {
  const name = direction.kind === "surprise"
    ? "Surprise"
    : vibeCatalog.find((option) => option.id === direction.moodId)?.label;
  return `Variation ${index} · ${name}`;
};

const originalSchema = z.object({
  id: z.literal("original"),
  label: z.literal("Original"),
  chords: playableChordsSchema,
}).strict().readonly();

export const progressionVariationSchema = z.object({
  id: z.string().regex(/^variation-[1-9]\d*$/),
  label: z.string().min(1),
  direction: variationDirectionSchema,
  chords: playableChordsSchema,
}).strict().readonly();

export const progressionCollectionSchema = z.object({
  original: originalSchema,
  variations: z.array(progressionVariationSchema).readonly(),
}).strict().refine(({ variations }) => variations.every((entry, index) =>
  entry.id === `variation-${index + 1}` && entry.label === variationLabel(index + 1, entry.direction),
), "Variations must retain their ordered identities and labels.").readonly();
export type ProgressionCollection = z.infer<typeof progressionCollectionSchema>;

const generationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("idle") }).strict().readonly(),
  z.object({ kind: z.literal("pending"), direction: variationDirectionSchema }).strict().readonly(),
  z.object({ kind: z.literal("error"), message: z.string().trim().min(1) }).strict().readonly(),
]);

export const progressionSessionSchema = z.object({
  vibeIds: progressionRequestSchema.shape.vibeIds.refine((ids) => getVibeLabels(ids) !== null).readonly(),
  variation: progressionRequestSchema.shape.variation,
  progressions: progressionCollectionSchema,
  generation: generationSchema,
}).strict().readonly();
export type ProgressionSession = z.infer<typeof progressionSessionSchema>;

export const createProgressionSession = (input: {
  vibeIds: readonly string[];
  variation?: z.input<typeof progressionRequestSchema.shape.variation>;
  chords: readonly string[];
}): ProgressionSession => {
  return progressionSessionSchema.parse({
    vibeIds: input.vibeIds,
    variation: input.variation,
    progressions: { original: { id: "original", label: "Original", chords: input.chords }, variations: [] },
    generation: { kind: "idle" },
  });
};

export const beginProgressionVariation = (session: ProgressionSession, direction: VariationDirection): ProgressionSession => {
  if (session.generation.kind === "pending") return session;
  return Object.freeze({ ...session, generation: generationSchema.parse({ kind: "pending", direction }) });
};

export const failProgressionVariation = (session: ProgressionSession, message: string): ProgressionSession => {
  if (session.generation.kind !== "pending") return session;
  return Object.freeze({ ...session, generation: generationSchema.parse({ kind: "error", message }) });
};

export const completeProgressionVariation = (session: ProgressionSession, chords: readonly string[]): ProgressionSession => {
  if (session.generation.kind !== "pending") return session;
  const parsed = playableChordsSchema.safeParse(chords);
  if (!parsed.success) return failProgressionVariation(session, "The variation was not playable. Please try again.");
  const index = session.progressions.variations.length + 1;
  const entry = progressionVariationSchema.parse({
    id: `variation-${index}`,
    label: variationLabel(index, session.generation.direction),
    direction: session.generation.direction,
    chords: parsed.data,
  });
  return Object.freeze({
    ...session,
    progressions: Object.freeze({
      original: session.progressions.original,
      variations: Object.freeze([...session.progressions.variations, entry]),
    }),
    generation: generationSchema.parse({ kind: "idle" }),
  });
};
