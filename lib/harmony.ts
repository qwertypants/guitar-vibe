import { CHORD_INTERVALS, SUPPORTED_CHORDS } from "@/lib/chords";

export type HarmonyAssessment = {
  coherent: boolean;
  scaleShare: number;
  blues: boolean;
  harmonicMinorCadence: boolean;
};

const SCALES = Array.from({ length: 12 }, (_, tonic) => {
  const modes = [
    [0, 2, 4, 5, 7, 9, 11],
    [0, 2, 3, 5, 7, 8, 10],
    [0, 2, 3, 5, 7, 8, 11],
  ];
  return modes.map((intervals) => new Set(intervals.map((interval) => (interval + tonic) % 12)));
}).flat();

export function assessProgressionHarmony(chords: readonly string[]): HarmonyAssessment {
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
    catalog.filter((chord) => CHORD_INTERVALS[chord.suffix].every((interval) =>
      scale.has((interval + chord.pitchClass) % 12))).length / catalog.length,
  ));
  return {
    coherent: blues || scaleShare >= 0.75 || harmonicMinorCadence,
    scaleShare,
    blues,
    harmonicMinorCadence,
  };
}
