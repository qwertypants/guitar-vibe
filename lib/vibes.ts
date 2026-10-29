export type VibeFacet = "mood" | "genre" | "era" | "setting" | "energy";

export type VibeOption<Facet extends VibeFacet = VibeFacet> =
  Facet extends VibeFacet
    ? {
        readonly id: string;
        readonly facet: Facet;
        readonly label: string;
        readonly synonyms: readonly string[];
        readonly promptTerms?: readonly string[];
      }
    : never;

export const vibeFacets: readonly { id: VibeFacet; label: string }[] = [
  { id: "mood", label: "Mood" },
  { id: "genre", label: "Genre" },
  { id: "era", label: "Era" },
  { id: "setting", label: "Setting" },
  { id: "energy", label: "Energy" },
];

export const vibeCatalog: readonly VibeOption[] = [
  { id: "mood-moody", facet: "mood", label: "Moody", synonyms: ["brooding"] },
  { id: "mood-dreamy", facet: "mood", label: "Dreamy", synonyms: ["ethereal", "dreamlike"] },
  { id: "mood-warm", facet: "mood", label: "Warm", synonyms: ["cozy", "comforting"] },
  { id: "mood-melancholy", facet: "mood", label: "Melancholy", synonyms: ["sad", "wistful"] },
  { id: "mood-hopeful", facet: "mood", label: "Hopeful", synonyms: ["optimistic"] },
  { id: "mood-romantic", facet: "mood", label: "Romantic", synonyms: ["love", "tender"] },
  { id: "mood-dark", facet: "mood", label: "Dark", synonyms: ["somber", "shadowy"] },
  { id: "mood-joyful", facet: "mood", label: "Joyful", synonyms: ["happy", "cheerful"] },
  { id: "mood-restless", facet: "mood", label: "Restless", synonyms: ["uneasy"] },
  { id: "mood-peaceful", facet: "mood", label: "Peaceful", synonyms: ["calm", "serene"] },
  { id: "mood-tense", facet: "mood", label: "Tense", synonyms: ["anxious", "suspenseful"] },
  { id: "mood-nostalgic", facet: "mood", label: "Nostalgic", synonyms: ["reminiscent", "memories"] },
  { id: "mood-passionate", facet: "mood", label: "Passionate", synonyms: ["passion", "ardent", "fervent"] },
  { id: "genre-r-and-b", facet: "genre", label: "R&B", synonyms: ["rnb", "rhythm and blues", "r and b"] },
  { id: "genre-neo-soul", facet: "genre", label: "Neo-soul", synonyms: ["neosoul", "neo soul"] },
  { id: "genre-blues", facet: "genre", label: "Blues", synonyms: ["bluesy"] },
  { id: "genre-jazz", facet: "genre", label: "Jazz", synonyms: ["jazzy"] },
  { id: "genre-indie", facet: "genre", label: "Indie", synonyms: ["independent", "alternative"] },
  { id: "genre-folk", facet: "genre", label: "Folk", synonyms: ["acoustic", "folk music"] },
  { id: "genre-pop", facet: "genre", label: "Pop", synonyms: ["popular", "radio"] },
  { id: "genre-rock", facet: "genre", label: "Rock", synonyms: ["rock and roll"] },
  { id: "genre-funk", facet: "genre", label: "Funk", synonyms: ["funky"] },
  { id: "genre-lo-fi", facet: "genre", label: "Lo-fi", synonyms: ["lofi", "lo fi", "low fidelity"] },
  { id: "genre-gospel", facet: "genre", label: "Gospel", synonyms: ["church", "spiritual"] },
  { id: "genre-country", facet: "genre", label: "Country", synonyms: ["americana", "country music"] },
  { id: "genre-flamenco", facet: "genre", label: "Flamenco", synonyms: ["spanish", "spain", "andalusian", "andalusia"] },
  { id: "genre-spanish-guitar", facet: "genre", label: "Spanish guitar", synonyms: ["spain", "guitarra española", "guitarra espanola"] },
  { id: "era-60s", facet: "era", label: "60s", synonyms: ["1960s", "sixties"] },
  { id: "era-70s", facet: "era", label: "70s", synonyms: ["1970s", "seventies"] },
  { id: "era-80s", facet: "era", label: "80s", synonyms: ["1980s", "eighties"] },
  { id: "era-90s", facet: "era", label: "90s", synonyms: ["1990s", "nineties"] },
  { id: "era-2000s", facet: "era", label: "2000s", synonyms: ["two thousands", "noughties", "aughts"] },
  { id: "era-modern", facet: "era", label: "Modern", synonyms: ["current", "contemporary"] },
  { id: "setting-rainy-night", facet: "setting", label: "Rainy night", synonyms: ["rain", "rainy", "wet evening"] },
  { id: "setting-late-night-drive", facet: "setting", label: "Late-night drive", synonyms: ["night drive", "late night drive", "midnight drive"] },
  { id: "setting-sunday-morning", facet: "setting", label: "Sunday morning", synonyms: ["weekend morning", "brunch"] },
  { id: "setting-campfire", facet: "setting", label: "Campfire", synonyms: ["bonfire", "camping"] },
  { id: "setting-coffee-shop", facet: "setting", label: "Coffee shop", synonyms: ["cafe", "café", "coffeehouse"] },
  { id: "setting-city-lights", facet: "setting", label: "City lights", synonyms: ["urban", "downtown"] },
  { id: "setting-bedroom", facet: "setting", label: "Bedroom", synonyms: ["at home", "private room"] },
  { id: "setting-beach-sunset", facet: "setting", label: "Beach sunset", synonyms: ["seaside", "ocean", "coast"] },
  { id: "setting-open-road", facet: "setting", label: "Open road", synonyms: ["road trip", "highway"] },
  { id: "setting-after-hours", facet: "setting", label: "After-hours", synonyms: ["after hours", "closing time"] },
  { id: "setting-first-dance", facet: "setting", label: "First dance", synonyms: ["wedding", "couple dance"] },
  { id: "setting-porch-swing", facet: "setting", label: "Porch swing", synonyms: ["front porch", "veranda"] },
  { id: "setting-seville-courtyard", facet: "setting", label: "Seville courtyard", synonyms: ["sevilla", "patio", "spanish", "spain", "andalusia"] },
  { id: "setting-granada-twilight", facet: "setting", label: "Granada twilight", synonyms: ["alhambra", "spanish", "spain", "andalusia"] },
  { id: "setting-flamenco-tablao", facet: "setting", label: "Flamenco tablao", synonyms: ["spanish", "spain", "flamenco stage"] },
  { id: "energy-gentle", facet: "energy", label: "Gentle", synonyms: ["soft", "delicate"] },
  { id: "energy-laid-back", facet: "energy", label: "Laid-back", synonyms: ["laid back", "relaxed", "chill"] },
  { id: "energy-steady", facet: "energy", label: "Steady", synonyms: ["even", "consistent"] },
  { id: "energy-uplifting", facet: "energy", label: "Uplifting", synonyms: ["energizing", "bright"] },
  { id: "energy-driving", facet: "energy", label: "Driving", synonyms: ["propulsive", "energetic"] },
  { id: "energy-intense", facet: "energy", label: "Intense", synonyms: ["powerful", "high energy"] },
  { id: "energy-fiery", facet: "energy", label: "Fiery", synonyms: ["fire", "fuego", "blazing"] },
];

export function searchVibes(
  query: string,
  catalog: readonly VibeOption[] = vibeCatalog,
): readonly VibeOption[] {
  const term = query.trim().toLocaleLowerCase();

  return catalog.filter((option) =>
    [option.label, option.facet, ...option.synonyms].some((text) =>
      text.toLocaleLowerCase().includes(term),
    ),
  );
}
