import { describe, expect, test } from "vitest";
import { searchVibes, vibeCatalog, vibeFacets, type VibeOption } from "@/lib/vibes";
import {
  getSelectedVibes,
  hasVibeSelection,
  removeVibe,
  selectVibe,
  surpriseVibes,
  toggleVibe,
} from "@/lib/vibe-selection";

function option(id: string): VibeOption {
  const match = vibeCatalog.find((item) => item.id === id);
  if (!match) throw new Error(`Missing catalog option ${id}`);
  return match;
}

describe("the local vibe catalog", () => {
  test("contains the exact initial facet labels and options with unique stable IDs", () => {
    expect(vibeFacets.map((facet) => facet.label)).toEqual([
      "Mood", "Genre", "Era", "Setting", "Energy",
    ]);
    const expected = {
      mood: ["Moody", "Dreamy", "Warm", "Melancholy", "Hopeful", "Romantic", "Dark", "Joyful", "Restless", "Peaceful", "Tense", "Nostalgic"],
      genre: ["R&B", "Neo-soul", "Blues", "Jazz", "Indie", "Folk", "Pop", "Rock", "Funk", "Lo-fi", "Gospel", "Country"],
      era: ["60s", "70s", "80s", "90s", "2000s", "Modern"],
      setting: ["Rainy night", "Late-night drive", "Sunday morning", "Campfire", "Coffee shop", "City lights", "Bedroom", "Beach sunset", "Open road", "After-hours", "First dance", "Porch swing"],
      energy: ["Gentle", "Laid-back", "Steady", "Uplifting", "Driving", "Intense"],
    };
    for (const facet of vibeFacets) {
      expect(vibeCatalog.filter((item) => item.facet === facet.id).map((item) => item.label))
        .toEqual(expected[facet.id]);
    }
    expect(new Set(vibeCatalog.map((item) => item.id)).size).toBe(vibeCatalog.length);
    expect(vibeCatalog.every((item) => item.id.length > 0)).toBe(true);
  });

  test("searches only matching labels, synonyms, or facets and ignores case and outer whitespace", () => {
    expect(searchVibes("  RAIN ").map((item) => item.label)).toEqual(["Rainy night"]);
    expect(searchVibes("wistful").map((item) => item.label)).toEqual(["Melancholy"]);
    expect(searchVibes("nineties").map((item) => item.label)).toEqual(["90s"]);
    expect(searchVibes("Genre")).toEqual(vibeCatalog.filter((item) => item.facet === "genre"));
    expect(searchVibes("no catalog match")).toEqual([]);
    expect(searchVibes("   ")).toEqual(vibeCatalog);
  });

  test("a data-only addition participates in search without returning prompt terms", () => {
    const extra: VibeOption = {
      id: "mood-reflective", facet: "mood", label: "Reflective",
      synonyms: ["thoughtful"], promptTerms: ["internal prompt wording"],
    };
    const expanded = [...vibeCatalog, extra];
    expect(searchVibes("thoughtful", expanded)).toEqual([extra]);
    expect(searchVibes("internal prompt wording", expanded)).toEqual([]);
  });
});

describe("facet selection", () => {
  test("requires one or more selected values", () => {
    expect(hasVibeSelection({})).toBe(false);
    expect(hasVibeSelection(selectVibe({}, option("mood-moody")))).toBe(true);
  });

  test("replaces one facet, preserves other facets, and does not mutate its input", () => {
    const initial = selectVibe(selectVibe({}, option("mood-moody")), option("genre-r-and-b"));
    const replaced = selectVibe(initial, option("mood-dreamy"));
    expect(getSelectedVibes(replaced).map((item) => item.label)).toEqual(["Dreamy", "R&B"]);
    expect(getSelectedVibes(initial).map((item) => item.label)).toEqual(["Moody", "R&B"]);
    expect(getSelectedVibes(removeVibe(replaced, "mood")).map((item) => item.label)).toEqual(["R&B"]);
  });

  test("toggles the current option off and toggles a different option on", () => {
    const selected = toggleVibe({}, option("mood-moody"));
    expect(toggleVibe(selected, option("mood-moody"))).toEqual({});
    expect(getSelectedVibes(toggleVibe(selected, option("mood-dreamy")))).toEqual([option("mood-dreamy")]);
  });

  test.each([0, 0.5, 0.999999])("Surprise me chooses one catalog option per facet for sample %s", (sample) => {
    const selection = surpriseVibes(() => sample);
    const selected = getSelectedVibes(selection);
    expect(hasVibeSelection(selection)).toBe(true);
    expect(selected).toHaveLength(vibeFacets.length);
    expect(selected.map((item) => item.facet)).toEqual(vibeFacets.map((facet) => facet.id));
    expect(selected.every((item) => vibeCatalog.includes(item))).toBe(true);
    for (const facet of vibeFacets) {
      const options = vibeCatalog.filter((item) => item.facet === facet.id);
      expect(selection[facet.id]).toBe(options[Math.floor(sample * options.length)]);
    }
  });

  test.each([-0.1, 1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid random sample %s", (sample) => {
    expect(() => surpriseVibes(() => sample)).toThrow(RangeError);
  });
});
