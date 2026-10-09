import { vibeCatalog, vibeFacets, type VibeFacet, type VibeOption } from "@/lib/vibes";

export type VibeSelection = {
  readonly [Facet in VibeFacet]?: VibeOption<Facet>;
};

export function selectVibe(
  selection: VibeSelection,
  option: VibeOption,
): VibeSelection {
  return { ...selection, [option.facet]: option };
}

export function removeVibe(
  selection: VibeSelection,
  facet: VibeFacet,
): VibeSelection {
  const next = { ...selection };
  delete next[facet];
  return next;
}

export function toggleVibe(
  selection: VibeSelection,
  option: VibeOption,
): VibeSelection {
  return selection[option.facet]?.id === option.id
    ? removeVibe(selection, option.facet)
    : selectVibe(selection, option);
}

export function getSelectedVibes(selection: VibeSelection): readonly VibeOption[] {
  return vibeFacets.flatMap(({ id }) => {
    const option = selection[id];
    return option ? [option] : [];
  });
}

export function hasVibeSelection(selection: VibeSelection): boolean {
  return getSelectedVibes(selection).length > 0;
}

export function surpriseVibes(random: () => number = Math.random): VibeSelection {
  let selection: VibeSelection = {};

  for (const facet of vibeFacets) {
    const options = vibeCatalog.filter((option) => option.facet === facet.id);
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError("Random samples must be between 0 inclusive and 1 exclusive.");
    }
    const option = options[Math.floor(sample * options.length)];
    if (!option) {
      throw new Error(`The ${facet.label} catalog needs at least one option.`);
    }
    selection = selectVibe(selection, option);
  }

  return selection;
}
