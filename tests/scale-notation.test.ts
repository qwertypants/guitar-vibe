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

  test("creates one ascending VexTab note event per played pitch", () => {
    const scale = getBestProgressionScale(["Am", "F", "C", "G"]);
    if (!scale) throw new Error("Missing scale fixture");
    const fretboard = getScaleFretboard(scale);
    const source = `tabstave notation=true tablature=true tuning=standard strings=6 time=4/4\nnotes ${Array.from({ length: 13 }, (_, fret) => fretboard.positions.filter((position) => position.fret === fret))
      .filter((group) => group.length > 0)
      .map((group) => `:q ${group.length > 1 ? `(${group.map(({ fret: positionFret, stringNumber }) => `${positionFret}/${stringNumber}`).join(".")})` : `${group[0]?.fret}/${group[0]?.stringNumber}`}`)
      .join(" ")}`;
    expect(source).toContain("tabstave notation=true tablature=true tuning=standard strings=6 time=4/4");
    expect(source).toContain("notes :q");
    expect(source).toContain("0/1.0/2.0/3.0/4.0/5.0/6");
    expect(source).toContain("12/1");
    const runSource = scaleFretboardToVexTab(fretboard.midiNotes, fretboard.positions);
    const events = [...runSource.matchAll(/:q (\d+)\/(\d+)/g)].map(([, fret, string]) => ({
      fret: Number(fret),
      stringNumber: Number(string),
    }));
    expect(events).toHaveLength(fretboard.midiNotes.length);
    expect(runSource).not.toMatch(/\([^)]*\)/);
    const selectedMidi = events.map(({ fret, stringNumber }) =>
      fretboard.positions.find((position) => position.fret === fret && position.stringNumber === stringNumber)?.midi);
    expect(selectedMidi).toEqual(fretboard.midiNotes);
    for (const [index, midi] of fretboard.midiNotes.entries()) {
      const chosen = events[index];
      const alternatives = fretboard.positions
        .filter((position) => position.midi === midi)
        .sort((a, b) => a.fret - b.fret || a.stringNumber - b.stringNumber);
      expect(chosen).toEqual({ fret: alternatives[0]?.fret, stringNumber: alternatives[0]?.stringNumber });
    }
  });

  test("renders the generated VexTab source into SVG", async () => {
    const scale = getBestProgressionScale(["Am", "F", "C", "G"]);
    if (!scale) throw new Error("Missing scale fixture");
    const element = document.createElement("div");
    const fretboard = getScaleFretboard(scale);
    await renderScaleVexTab(element, scaleFretboardToVexTab(fretboard.midiNotes, fretboard.positions));
    const svg = element.querySelector("svg");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(Number(svg?.getAttribute("height"))).toBeLessThan(300);
    expect(element.querySelector('svg rect[fill="white"]')).not.toBeNull();
  });
});
