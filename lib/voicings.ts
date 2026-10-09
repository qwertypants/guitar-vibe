import {
  CHORD_ROOTS,
  SUPPORTED_CHORDS,
  parseChordSymbol,
  type ChordSuffix,
  type SupportedChordSymbol,
} from "@/lib/chords";

/** Strings and frets are always ordered low E to high E. null means muted. */
export type GuitarFrets = readonly [
  number | null, number | null, number | null,
  number | null, number | null, number | null,
];
export const STANDARD_TUNING_MIDI = [40, 45, 50, 55, 59, 64] as const;

export interface VoicingNote {
  readonly stringNumber: number;
  readonly fret: number;
  readonly midi: number;
  readonly name: string;
}

export interface ChordVoicing {
  readonly id: string;
  readonly chord: SupportedChordSymbol;
  readonly label: string;
  readonly frets: GuitarFrets;
  readonly baseFret: number;
  readonly notes: readonly VoicingNote[];
  /** Includes octave doublings in string order. Muted strings are absent. */
  readonly midiNotes: readonly number[];
}

export type ChordResolution =
  | { readonly kind: "resolved"; readonly symbol: SupportedChordSymbol; readonly voicings: readonly [ChordVoicing, ...ChordVoicing[]] }
  | { readonly kind: "unsupported"; readonly input: unknown };

// Locally authored standard movable E/A shapes. Offsets transpose with the root fret.
const E_SHAPES = {
  "": [0, 2, 2, 1, 0, 0],
  m: [0, 2, 2, 0, 0, 0],
  "7": [0, 2, 0, 1, 0, 0],
  maj7: [0, null, 1, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
} as const satisfies Record<ChordSuffix, GuitarFrets>;

const A_SHAPES = {
  "": [null, 0, 2, 2, 2, 0],
  m: [null, 0, 2, 2, 1, 0],
  "7": [null, 0, 2, 0, 2, 0],
  maj7: [null, 0, 2, 1, 2, 0],
  m7: [null, 0, 2, 0, 1, 0],
} as const satisfies Record<ChordSuffix, GuitarFrets>;

const OPEN_SHAPES: Partial<Record<SupportedChordSymbol, GuitarFrets>> = {
  C: [null, 3, 2, 0, 1, 0],
  D: [null, null, 0, 2, 3, 2],
  Dm: [null, null, 0, 2, 3, 1],
  G: [3, 2, 0, 0, 0, 3],
};

function transpose(shape: GuitarFrets, rootFret: number): GuitarFrets {
  const shift = (fret: number | null) => fret === null ? null : fret + rootFret;
  return [shift(shape[0]), shift(shape[1]), shift(shape[2]), shift(shape[3]), shift(shape[4]), shift(shape[5])];
}

function makeVoicing(chord: SupportedChordSymbol, id: string, frets: GuitarFrets): ChordVoicing {
  const notes = STANDARD_TUNING_MIDI.flatMap((openMidi, index) => {
    const fret = frets[index];
    if (fret === null || fret === undefined) return [];
    const midi = openMidi + fret;
    const name = `${CHORD_ROOTS[midi % 12]}${Math.floor(midi / 12) - 1}`;
    return [{ stringNumber: 6 - index, fret, midi, name }];
  });
  const baseFret = Math.max(1, Math.min(...frets.filter((fret) => fret !== null)));
  return {
    id: `${chord}-${id}`, chord, frets, baseFret, notes,
    label: frets.includes(0) ? "Open position" : `Fret ${baseFret} (${id}-shape)`,
    midiNotes: notes.map((note) => note.midi),
  };
}

const VOICINGS = new Map<SupportedChordSymbol, readonly [ChordVoicing, ...ChordVoicing[]]>(
  SUPPORTED_CHORDS.map(({ symbol, pitchClass, suffix }) => {
    const eFret = (pitchClass - 4 + 12) % 12;
    const aFret = (pitchClass - 9 + 12) % 12;
    const movable = [
      makeVoicing(symbol, "E", transpose(E_SHAPES[suffix], eFret)),
      makeVoicing(symbol, "A", transpose(A_SHAPES[suffix], aFret)),
    ].sort((left, right) => left.baseFret - right.baseFret);
    const open = OPEN_SHAPES[symbol];
    const first = open ? makeVoicing(symbol, "open", open) : movable.shift();
    if (!first) throw new Error(`Missing trusted voicing for ${symbol}`);
    return [symbol, [first, ...movable]];
  }),
);

export function getChordVoicings(symbol: SupportedChordSymbol) {
  return VOICINGS.get(symbol);
}

/** Generation should retain only resolved results; rendering and playback use the selected voicing. */
export function resolveChord(input: unknown): ChordResolution {
  const symbol = parseChordSymbol(input);
  const voicings = symbol ? getChordVoicings(symbol) : undefined;
  return symbol && voicings
    ? { kind: "resolved", symbol, voicings }
    : { kind: "unsupported", input };
}
