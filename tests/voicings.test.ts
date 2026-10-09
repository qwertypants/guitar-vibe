import { describe, expect, test } from "vitest";
import { CHORD_INTERVALS, SUPPORTED_CHORDS, parseChordSymbol } from "@/lib/chords";
import { resolveChord, STANDARD_TUNING_MIDI } from "@/lib/voicings";
import { voicingToVexTab } from "@/lib/chord-notation";

describe("trusted chord catalog", () => {
  test.each([
    [" C ", "C"], ["Dbmaj7", "C#maj7"], ["B♭m7", "A#m7"], ["F♯7", "F#7"], ["Cb", "B"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(parseChordSymbol(input)).toBe(expected);
  });

  test.each(["", "c", "C/E", "Cm9", "Cdim", "C sus4", "C;alert(1)", "Hm", null, 42])(
    "rejects unsupported or untrusted symbols (%s)", (input) => {
      expect(resolveChord(input).kind).toBe("unsupported");
    },
  );

  test("all 60 symbols have playable positions with exactly the expected chord tones", () => {
    expect(SUPPORTED_CHORDS).toHaveLength(60);
    const ids = new Set<string>();
    for (const { symbol, pitchClass, suffix } of SUPPORTED_CHORDS) {
      const result = resolveChord(symbol);
      expect(result.kind).toBe("resolved");
      if (result.kind !== "resolved") throw new Error(symbol);
      expect(result.voicings.length).toBeGreaterThanOrEqual(2);
      for (const voicing of result.voicings) {
        expect(ids.has(voicing.id)).toBe(false);
        ids.add(voicing.id);
        const expectedPitches = CHORD_INTERVALS[suffix].map((interval) => (pitchClass + interval) % 12).sort((a, b) => a - b);
        expect([...new Set(voicing.midiNotes.map((note) => note % 12))].sort((a, b) => a - b)).toEqual(expectedPitches);
        expect(voicing.notes.map((note) => note.midi)).toEqual(voicing.midiNotes);
        expect(voicing.notes).toHaveLength(voicing.frets.filter((fret) => fret !== null).length);
        for (const note of voicing.notes) {
          expect(note.midi).toBe(Number(STANDARD_TUNING_MIDI[6 - note.stringNumber]) + note.fret);
          expect(note.fret).toBeGreaterThanOrEqual(0);
          expect(note.fret).toBeLessThanOrEqual(13);
        }
        const fretted = voicing.notes.filter((note) => note.fret > 0).map((note) => note.fret);
        expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
      }
    }
  });

  test("C open and fret-eight selections expose distinct exact notes and trusted tab syntax", () => {
    const chord = resolveChord("C");
    if (chord.kind !== "resolved") throw new Error("Missing C");
    const open = chord.voicings[0];
    const higher = chord.voicings.find((voicing) => voicing.id === "C-E");
    if (!higher) throw new Error("Missing higher C");
    expect(open.frets).toEqual([null, 3, 2, 0, 1, 0]);
    expect(open.midiNotes).toEqual([48, 52, 55, 60, 64]);
    expect(open.notes.map((note) => note.name)).toEqual(["C3", "E3", "G3", "C4", "E4"]);
    expect(higher.frets).toEqual([8, 10, 10, 9, 8, 8]);
    expect(higher.midiNotes).toEqual([48, 55, 60, 64, 67, 72]);
    expect(voicingToVexTab(open)).toContain("(3/5.2/4.0/3.1/2.0/1)");
    expect(voicingToVexTab(higher)).toContain("(8/6.10/5.10/4.9/3.8/2.8/1)");
  });
});
