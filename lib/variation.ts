import { z } from "zod";

export const VARIATION_MODES = ["familiar", "richer", "adventurous"] as const;
export type VariationMode = (typeof VARIATION_MODES)[number];
export const variationModeSchema = z.enum(VARIATION_MODES);

export const variationModeOptions: readonly {
  value: VariationMode;
  label: string;
  description: string;
}[] = [
  { value: "familiar", label: "Familiar", description: "Common, familiar chord sounds" },
  { value: "richer", label: "Richer chords", description: "More seventh and suspended chords" },
  { value: "adventurous", label: "Adventurous", description: "Less expected chord colors" },
];
