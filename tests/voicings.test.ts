import { describe, expect, test } from "vitest";
import { CHORD_INTERVALS, SUPPORTED_CHORDS as ALL_SUPPORTED_CHORDS, parseChordSymbol } from "@/lib/chords";
import { resolveChord, STANDARD_TUNING_MIDI } from "@/lib/voicings";
import { voicingToVexTab } from "@/lib/chord-notation";

const SUPPORTED_CHORDS = ALL_SUPPORTED_CHORDS.filter(({ suffix }) => suffix !== "sus2" && suffix !== "sus4");

describe("trusted chord catalog", () => {
  test.each([
    [" C ", "C"], ["Dbmaj7", "C#maj7"], ["B♭m7", "A#m7"], ["F♯7", "F#7"], ["Cb", "B"],
    ["Csus2", "Csus2"], ["D♭sus4", "C#sus4"], ["F♯sus2", "F#sus2"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(parseChordSymbol(input)).toBe(expected);
  });

  test.each(["", "c", "C/E", "Cm9", "Cdim", "C sus4", "C;alert(1)", "Hm", null, 42])(
    "rejects unsupported or untrusted symbols (%s)", (input) => {
      expect(resolveChord(input).kind).toBe("unsupported");
    },
  );

  test("all 60 original symbols have playable positions with exactly the expected chord tones", () => {
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

  test("all 84 symbols round-trip; suspended voicings contain only their catalog tones", () => {
    expect(ALL_SUPPORTED_CHORDS).toHaveLength(84);
    for (const { symbol, pitchClass, suffix } of ALL_SUPPORTED_CHORDS) {
      expect(parseChordSymbol(symbol)).toBe(symbol);
      if (suffix !== "sus2" && suffix !== "sus4") continue;
      const result = resolveChord(symbol);
      expect(result.kind).toBe("resolved");
      if (result.kind !== "resolved") throw new Error(symbol);
      const expectedPitches = CHORD_INTERVALS[suffix].map((interval) => (pitchClass + interval) % 12).sort((a, b) => a - b);
      for (const voicing of result.voicings) {
        expect([...new Set(voicing.midiNotes.map((note) => note % 12))].sort((a, b) => a - b)).toEqual(expectedPitches);
        expect(voicing.notes.map((note) => note.midi)).toEqual(voicing.midiNotes);
        const fretted = voicing.notes.filter((note) => note.fret > 0).map((note) => note.fret);
        expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
      }
    }
  });

  test("suspended symbols expose the expected interval metadata and exact C voicings", () => {
    expect(CHORD_INTERVALS.sus2).toEqual([0, 2, 7]);
    expect(CHORD_INTERVALS.sus4).toEqual([0, 5, 7]);
    const sus2 = resolveChord("Csus2");
    const sus4 = resolveChord("Csus4");
    if (sus2.kind !== "resolved" || sus4.kind !== "resolved") throw new Error("Missing suspended chord voicing");
    expect(sus2.voicings[0]).toMatchObject({
      frets: [null, 3, 5, 5, 3, 3],
      midiNotes: [48, 55, 60, 62, 67],
      notes: ["C3", "G3", "C4", "D4", "G4"].map((name) => ({ name })),
    });
    expect(sus4.voicings[0]).toMatchObject({
      frets: [null, 3, 5, 5, 6, 3],
      midiNotes: [48, 55, 60, 65, 67],
      notes: ["C3", "G3", "C4", "F4", "G4"].map((name) => ({ name })),
    });
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

test("diagram string positions reconstruct every catalog voicing and its playback notes", async () => {
  const { voicingToVexChords } = await import("@/lib/chord-notation");
  for (const { symbol } of ALL_SUPPORTED_CHORDS) {
    const resolved = resolveChord(symbol);
    if (resolved.kind !== "resolved") throw new Error(symbol);
    for (const voicing of resolved.voicings) {
      const data = voicingToVexChords(voicing);
      expect(data.chord.map(([string]) => string)).toEqual([6, 5, 4, 3, 2, 1]);
      const reconstructed = data.chord.map(([, fret]) => fret === "x" ? null : fret === 0 ? 0 : fret + Math.max(1, data.position) - 1);
      expect(reconstructed).toEqual(voicing.frets);
      expect(reconstructed.flatMap((fret, index) => fret === null ? [] : [STANDARD_TUNING_MIDI[index]! + fret])).toEqual(voicing.midiNotes);
      for (const [, fret] of data.chord) {
        if (typeof fret === "number") expect(fret).toBeLessThanOrEqual(5);
      }
    }
  }
  const c = resolveChord("C");
  if (c.kind !== "resolved") throw new Error("Missing C");
  expect(voicingToVexChords(c.voicings[0]).chord).toEqual([[6, "x"], [5, 3], [4, 2], [3, 0], [2, 1], [1, 0]]);
  const high = c.voicings.find((voicing) => voicing.id === "C-E")!;
  expect(voicingToVexChords(high)).toMatchObject({ position: 8, chord: [[6, 1], [5, 3], [4, 3], [3, 2], [2, 1], [1, 1]] });
});
