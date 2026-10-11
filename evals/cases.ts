export type Expectation = "minor" | "major-opening" | "seventh" | "triads" | "blues";
export type EvalCase = { id: string; vibeIds: readonly string[]; expectations: readonly Expectation[]; holdout: boolean };
// Holdouts combine catalog selections independently; none are prompt examples.
export const CASES: readonly EvalCase[] = [
  { id: "melancholy", vibeIds: ["mood-melancholy"], expectations: ["minor"], holdout: false },
  { id: "dark", vibeIds: ["mood-dark"], expectations: ["minor"], holdout: false },
  { id: "joyful", vibeIds: ["mood-joyful"], expectations: ["major-opening"], holdout: false },
  { id: "hopeful", vibeIds: ["mood-hopeful"], expectations: ["major-opening"], holdout: false },
  { id: "blues", vibeIds: ["genre-blues"], expectations: ["blues"], holdout: false },
  { id: "jazz", vibeIds: ["genre-jazz"], expectations: ["seventh"], holdout: false },
  { id: "neo-soul", vibeIds: ["genre-neo-soul"], expectations: ["seventh"], holdout: false },
  { id: "folk", vibeIds: ["genre-folk"], expectations: ["triads"], holdout: false },
  { id: "pop", vibeIds: ["genre-pop"], expectations: ["triads"], holdout: false },
  { id: "era-setting", vibeIds: ["era-80s", "setting-city-lights", "energy-steady"], expectations: [], holdout: false },
  { id: "holdout-dark-folk", vibeIds: ["mood-dark", "genre-folk", "era-60s", "setting-porch-swing", "energy-gentle"], expectations: ["minor", "triads"], holdout: true },
  { id: "holdout-joyful-pop", vibeIds: ["mood-joyful", "genre-pop", "era-2000s", "setting-open-road", "energy-uplifting"], expectations: ["major-opening", "triads"], holdout: true },
  { id: "holdout-melancholy-jazz", vibeIds: ["mood-melancholy", "genre-jazz", "setting-coffee-shop", "energy-laid-back"], expectations: ["minor", "seventh"], holdout: true },
  { id: "holdout-blues", vibeIds: ["genre-blues", "era-70s", "setting-campfire", "energy-driving"], expectations: ["blues"], holdout: true },
];
