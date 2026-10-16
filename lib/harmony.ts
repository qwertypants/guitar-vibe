import { CHORD_INTERVALS, CHORD_ROOTS, SUPPORTED_CHORDS } from "@/lib/chords";
import type { ProgressionScale } from "@/types/scales";

export type HarmonyAssessment = {
  coherent: boolean;
  scaleShare: number;
  blues: boolean;
  harmonicMinorCadence: boolean;
};

const SCALE_TYPES = [
  { quality: "major", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { quality: "minor", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { quality: "harmonic minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
] as const;

const SCALES = CHORD_ROOTS.flatMap((root, tonic) => SCALE_TYPES.map(({ quality, intervals }) => ({
  id: `${root}-${quality.replaceAll(" ", "-")}`,
  name: `${root} ${quality}`,
  root,
  pitchClasses: intervals.map((interval) => (interval + tonic) % 12),
}))) satisfies readonly ProgressionScale[];

const scaleContainsChord = (scale: ProgressionScale, chord: (typeof SUPPORTED_CHORDS)[number]) =>
  CHORD_INTERVALS[chord.suffix].every((interval) => scale.pitchClasses.includes((interval + chord.pitchClass) % 12));

export function getBestProgressionScale(chords: readonly string[]): ProgressionScale | null {
  const known = chords.map((symbol) => SUPPORTED_CHORDS.find((chord) => chord.symbol === symbol));
  if (known.length === 0 || known.some((chord) => !chord)) return null;
  const catalog = known.filter((chord) => chord !== undefined);
  let best: ProgressionScale | undefined;
  let bestCount = -1;
  for (const scale of SCALES) {
    const count = catalog.filter((chord) => scaleContainsChord(scale, chord)).length;
    if (count > bestCount) {
      best = scale;
      bestCount = count;
    }
  }
  return best ?? null;
}

export function assessProgressionHarmony(chords: readonly string[], allowBlues = false): HarmonyAssessment {
  const known = chords.map((symbol) => SUPPORTED_CHORDS.find((chord) => chord.symbol === symbol));
  if (known.length === 0 || known.some((chord) => !chord)) {
    return { coherent: false, scaleShare: 0, blues: false, harmonicMinorCadence: false };
  }

  const catalog = known.filter((chord) => chord !== undefined);
  const majorBlues = catalog.some((tonic) => {
    const roots = [tonic.pitchClass, (tonic.pitchClass + 5) % 12, (tonic.pitchClass + 7) % 12];
    return catalog.every((chord) => chord.suffix === "7" && roots.includes(chord.pitchClass)) &&
      roots.every((root) => catalog.some((chord) => chord.pitchClass === root));
  });
  const minorBlues = catalog.some((tonic) => {
    const roots = [tonic.pitchClass, (tonic.pitchClass + 5) % 12, (tonic.pitchClass + 7) % 12];
    return catalog.every((chord) => roots.includes(chord.pitchClass) &&
      (chord.pitchClass === tonic.pitchClass || chord.pitchClass === (tonic.pitchClass + 5) % 12
        ? chord.suffix === "m7"
        : chord.suffix === "7")) && roots.every((root) => catalog.some((chord) => chord.pitchClass === root));
  });
  const blues = majorBlues || minorBlues;
  const harmonicMinorCadence = catalog.some((chord, index) => {
    const next = catalog[(index + 1) % catalog.length];
    return chord.suffix === "7" && next !== undefined &&
      next.pitchClass === (chord.pitchClass + 5) % 12 && (next.suffix === "m" || next.suffix === "m7");
  });
  const scaleShare = Math.max(...SCALES.map((scale) =>
    catalog.filter((chord) => scaleContainsChord(scale, chord)).length / catalog.length,
  ));
  return {
    coherent: (allowBlues && blues) || scaleShare >= 0.75 || harmonicMinorCadence,
    scaleShare,
    blues,
    harmonicMinorCadence,
  };
}
