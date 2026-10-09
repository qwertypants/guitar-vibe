export const CHORD_ROOTS = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

export const CHORD_SUFFIXES = ["", "m", "7", "maj7", "m7"] as const;
export type ChordRoot = (typeof CHORD_ROOTS)[number];
export type ChordSuffix = (typeof CHORD_SUFFIXES)[number];
export type SupportedChordSymbol = `${ChordRoot}${ChordSuffix}`;

const ENHARMONIC_ROOTS: Readonly<Record<string, ChordRoot>> = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#",
  Cb: "B", Fb: "E", "B#": "C", "E#": "F",
};

export const CHORD_INTERVALS = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
} as const satisfies Record<ChordSuffix, readonly number[]>;

export const SUPPORTED_CHORDS = CHORD_ROOTS.flatMap((root, pitchClass) =>
  CHORD_SUFFIXES.map((suffix) => {
    const symbol: SupportedChordSymbol = `${root}${suffix}`;
    return { symbol, root, pitchClass, suffix };
  }),
);

/** A closed allowlist, including flat/sharp enharmonics. No slash chords or extensions. */
export function parseChordSymbol(input: unknown): SupportedChordSymbol | null {
  if (typeof input !== "string") return null;
  const match = /^([A-G])([#b]?)(maj7|m7|m|7)?$/.exec(
    input.trim().replaceAll("♯", "#").replaceAll("♭", "b"),
  );
  if (!match) return null;
  const rawRoot = `${match[1]}${match[2]}`;
  const root = CHORD_ROOTS.find((item) => item === rawRoot) ?? ENHARMONIC_ROOTS[rawRoot];
  const suffix = CHORD_SUFFIXES.find((item) => item === (match[3] ?? ""));
  if (!root || suffix === undefined) return null;
  return `${root}${suffix}`;
}
