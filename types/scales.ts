export type ProgressionScale = {
  readonly id: string;
  readonly name: string;
  readonly root: string;
  readonly pitchClasses: readonly number[];
};

export type ScaleFretPosition = {
  readonly stringNumber: number;
  readonly fret: number;
  readonly midi: number;
};

export type ScaleStringRow = {
  readonly stringNumber: number;
  readonly label: string;
  readonly positions: readonly ScaleFretPosition[];
};

export type ScaleFretboard = {
  readonly rows: readonly ScaleStringRow[];
  readonly positions: readonly ScaleFretPosition[];
  readonly midiNotes: readonly number[];
};

export type ScalePracticeProps = {
  scale: ProgressionScale;
  rows: readonly ScaleStringRow[];
  positions: readonly ScaleFretPosition[];
  midiNotes: readonly number[];
  active: boolean;
  onPlay: (scaleId: string, midiNotes: readonly number[]) => void;
};
