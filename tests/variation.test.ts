import { describe, expect, it } from "vitest";
import { variationModeOptions, variationModeSchema } from "@/lib/variation";

describe("variation mode contract", () => {
  it("accepts each supported mode and rejects unknown values", () => {
    for (const mode of ["familiar", "richer", "adventurous"]) {
      expect(variationModeSchema.safeParse(mode).success).toBe(true);
    }
    expect(variationModeSchema.safeParse("random").success).toBe(false);
  });

  it("provides a label and explanation for every mode", () => {
    expect(variationModeOptions.map(({ value }) => value)).toEqual(["familiar", "richer", "adventurous"]);
    expect(variationModeOptions.every(({ label, description }) => label.length > 0 && description.length > 0)).toBe(true);
  });
});
