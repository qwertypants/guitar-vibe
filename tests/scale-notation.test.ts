// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { getBestProgressionScale } from "@/lib/harmony";
import { getScaleFretboard, renderScaleVexTab, scaleFretboardToVexTab } from "@/lib/scale-notation";

describe("progression scales", () => {
  test("selects one best-fit scale with stable catalog-order ties", () => {
    expect(getBestProgressionScale(["Am", "F", "C", "G"])?.name).toBe("C major");
    expect(getBestProgressionScale(["E7", "Am"])?.name).toBe("A harmonic minor");
    expect(getBestProgressionScale([])).toBeNull();
    expect(getBestProgressionScale(["C", "H7"])).toBeNull();
  });

  test("maps every matching pitch across open strings through fret 12", () => {
    const scale = getBestProgressionScale(["Am", "F", "C", "G"]);
    if (!scale) throw new Error("Missing scale fixture");
    const fretboard = getScaleFretboard(scale);
    expect(fretboard.rows.map(({ label }) => label)).toEqual(["High E", "B", "G", "D", "A", "Low E"]);
    expect(fretboard.rows[0]?.positions).toContainEqual({ stringNumber: 1, fret: 0, midi: 64 });
    expect(fretboard.rows[0]?.positions).toContainEqual({ stringNumber: 1, fret: 12, midi: 76 });
    expect(fretboard.rows[5]?.positions).toContainEqual({ stringNumber: 6, fret: 0, midi: 40 });
    expect(fretboard.midiNotes).toEqual([...new Set(fretboard.midiNotes)].sort((a, b) => a - b));
    expect(fretboard.midiNotes[0]).toBe(40);
    expect(fretboard.midiNotes.at(-1)).toBe(76);
  });

  test("creates a VexTab fretboard with high E as string 1", () => {
    const scale = getBestProgressionScale(["Am", "F", "C", "G"]);
    if (!scale) throw new Error("Missing scale fixture");
    const fretboard = getScaleFretboard(scale);
    const source = scaleFretboardToVexTab(fretboard.positions);
    expect(source).toContain("tabstave notation=true tablature=true tuning=standard strings=6 time=4/4");
    expect(source).toContain("notes :q");
    expect(source).toContain("0/1.0/2.0/3.0/4.0/5.0/6");
    expect(source).toContain("12/1");
  });

  test("renders the generated VexTab source into SVG", async () => {
    const scale = getBestProgressionScale(["Am", "F", "C", "G"]);
    if (!scale) throw new Error("Missing scale fixture");
    const element = document.createElement("div");
    await renderScaleVexTab(element, scaleFretboardToVexTab(getScaleFretboard(scale).positions));
    const svg = element.querySelector("svg");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(Number(svg?.getAttribute("height"))).toBeLessThan(300);
    expect(element.querySelector('svg rect[fill="white"]')).not.toBeNull();
  });
});
