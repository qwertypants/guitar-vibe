import { z } from "zod";
import { parseSnapshot, savedVibeSchema, type SavedVibe } from "@/lib/saved-vibe";

export const BROWSER_VIBES_KEY = "guitar-vibe:saved-vibes:v1";
const storeSchema = z.object({
  nextId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  vibes: z.array(savedVibeSchema),
}).strict().refine(({ nextId, vibes }) =>
  new Set(vibes.map(({ id }) => id)).size === vibes.length && vibes.every(({ id }) => id < nextId));

export function createBrowserVibesStore(getStorage: () => Pick<Storage, "getItem" | "setItem"> = () => window.localStorage) {
  const read = () => {
    const raw = getStorage().getItem(BROWSER_VIBES_KEY);
    if (raw === null) return { nextId: 1, vibes: [] };
    const parsed = storeSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new Error("Saved vibes are damaged. Existing browser data has been kept.");
    return parsed.data;
  };
  return {
    list(): SavedVibe[] {
      return read().vibes.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    },
    save(snapshot: unknown): SavedVibe {
      const parsed = parseSnapshot(snapshot);
      if (!parsed) throw new Error("The vibe settings or chords are invalid.");
      const state = read();
      if (state.nextId === Number.MAX_SAFE_INTEGER) throw new Error("Browser storage has reached its saved vibe limit.");
      const vibe = { id: state.nextId, createdAt: new Date().toISOString(), ...parsed };
      getStorage().setItem(BROWSER_VIBES_KEY, JSON.stringify({ nextId: state.nextId + 1, vibes: [...state.vibes, vibe] }));
      return vibe;
    },
    delete(id: number): void {
      const state = read();
      if (!state.vibes.some((vibe) => vibe.id === id)) throw new Error("Saved vibe not found.");
      getStorage().setItem(BROWSER_VIBES_KEY, JSON.stringify({ ...state, vibes: state.vibes.filter((vibe) => vibe.id !== id) }));
    },
  };
}
