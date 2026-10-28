import { z } from "zod";
import { getFallbackProgression } from "@/lib/builtin-progression";
import { createBrowserVibesStore } from "@/lib/browser-vibes-store";
import { getVibeLabels, resolveProgression } from "@/lib/progression";
import { generationRequestSchema, getBuiltinVariation, getGenerationContext } from "@/lib/progression-variation";
import { savedVibeSchema, type SaveVibeSnapshot } from "@/lib/saved-vibe";

export const isPagesMode = process.env.NEXT_PUBLIC_APP_MODE === "pages";
async function readResponse(response: Response): Promise<unknown> {
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(payload);
    throw new Error(error.success ? error.data.error : "This request could not be completed. Please try again.");
  }
  return payload;
}

const browserStore = createBrowserVibesStore();
const browserService = {
  async generate(input: z.input<typeof generationRequestSchema>) {
    const request = getGenerationContext(input);
    const labels = getVibeLabels(request.vibeIds);
    if (!labels) throw new Error("Please choose valid vibe options.");
    const chords = resolveProgression(request.exploration
      ? getBuiltinVariation(labels, request.variation, request.exploration.originalChords)
      : getFallbackProgression(labels, request.variation));
    if (!chords) throw new Error("This progression could not be played.");
    return { chords, fallbackUsed: false };
  },
  async list() { return browserStore.list(); },
  async save(snapshot: SaveVibeSnapshot) { browserStore.save(snapshot); },
  async delete(id: number) { browserStore.delete(id); },
};
const httpService: typeof browserService = {
  async generate(input) {
    generationRequestSchema.parse(input);
    const payload = await readResponse(await fetch("/api/progression", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
    }));
    const parsed = z.object({ chords: z.array(z.object({ symbol: z.string() })).min(3).max(6), fallbackUsed: z.boolean().default(false) }).safeParse(payload);
    if (!parsed.success) throw new Error("We couldn't generate a progression. Please try again.");
    const chords = resolveProgression(parsed.data.chords.map(({ symbol }) => symbol));
    if (!chords || new Set(chords.map((chord) => chord.symbol)).size < 2) throw new Error("This progression could not be played.");
    if (input.exploration && JSON.stringify(chords.map((chord) => chord.symbol)) === JSON.stringify(input.exploration.originalChords)) {
      throw new Error("The variation repeated the original. Please try again.");
    }
    return { chords, fallbackUsed: parsed.data.fallbackUsed };
  },
  async list() {
    return z.object({ vibes: z.array(savedVibeSchema) }).parse(await readResponse(await fetch("/api/vibes"))).vibes;
  },
  async save(snapshot) {
    await readResponse(await fetch("/api/vibes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(snapshot) }));
  },
  async delete(id) {
    const response = await fetch(`/api/vibes/${id}`, { method: "DELETE" });
    if (!response.ok) await readResponse(response);
  },
};
export const vibeService = isPagesMode ? browserService : httpService;
