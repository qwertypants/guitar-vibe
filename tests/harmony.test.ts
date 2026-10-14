import { describe, expect, it } from "vitest";
import { assessProgressionHarmony } from "@/lib/harmony";

describe("assessProgressionHarmony", () => {
  it("accepts progressions whose chord tones fit a common scale", () => {
    expect(assessProgressionHarmony(["Am", "F", "C", "G"]).coherent).toBe(true);
  });

  it("accepts major and minor blues root relationships", () => {
    expect(assessProgressionHarmony(["E7", "A7", "B7"]).blues).toBe(true);
    expect(assessProgressionHarmony(["Am7", "Dm7", "E7"]).blues).toBe(true);
  });

  it("accepts a harmonic-minor dominant-to-tonic cadence", () => {
    const result = assessProgressionHarmony(["E7", "Am"]);
    expect(result.harmonicMinorCadence).toBe(true);
    expect(result.coherent).toBe(true);
  });

  it("rejects an incoherent progression and unsupported symbols", () => {
    expect(assessProgressionHarmony(["C", "C#", "F#"]).coherent).toBe(false);
    expect(assessProgressionHarmony(["C", "H7", "G"]).coherent).toBe(false);
  });
});
