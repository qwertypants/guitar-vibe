import "server-only";
import { z } from "zod";
import { SUPPORTED_CHORDS } from "@/lib/chords";
import { assessProgressionHarmony } from "@/lib/harmony";
import { getVibeLabels, progressionRequestSchema, progressionSchema, resolveProgression } from "@/lib/progression";
import type { VariationMode } from "@/lib/variation";

export type LocalModelErrorCode = "invalid_input" | "configuration" | "unavailable" | "timeout" | "invalid_output";
export class LocalModelError extends Error {
  constructor(public readonly code: LocalModelErrorCode) {
    super(code);
    this.name = "LocalModelError";
  }
}

export type GenerationOptions = { model?: string; baseUrl?: string; seed?: number; signal?: AbortSignal; variation?: VariationMode };
const MAX_RESPONSE_BYTES = 64 * 1024;
const DEADLINE_MS = 30_000;
const chordSymbols = SUPPORTED_CHORDS.map(({ symbol }) => symbol);
const candidateEnvelopeSchema = z.object({ candidates: z.array(z.unknown()).min(1).max(3) }).strict();
const candidateSchema = z.object({ chords: z.array(z.unknown()).min(3).max(6) }).strict();
const REQUESTED_CANDIDATES = 3;
const OUTPUT_TOKENS = 384;
export const LOCAL_MODEL_PROMPT_TEMPLATE = [
  "Create three candidate coherent, playable guitar chord progressions inspired by these selected vibes:",
  "{selected vibe labels}",
  "Variation mode: {variation mode}.",
  "Return JSON shaped as {\"candidates\":[{\"chords\":[\"Am\",\"F\",\"G\"]}]}, with up to three candidate progressions. Each candidate has 3 to 6 chord symbols and at least two distinct chords. Use one tonal center and common diatonic triads or seventh chords; at least 75% of chords should fit one major or minor scale.",
  "Mood and genre are style cues, not universal theory rules. Use them to guide character while keeping the harmony coherent.",
  "A minor-key dominant seventh on scale degree V may resolve to minor i as a harmonic-minor V7-to-i cadence. Blues may use a major pattern of dominant-7 I, IV, and V, or a minor pattern of minor-7 i and iv with dominant-7 V.",
  "Prefer smooth guitar voice leading. Return only the required JSON using symbols from the supported chord catalog; the app supplies playable guitar voicings.",
].join("\n");
export function buildLocalModelPrompt(labels: readonly string[]) {
  return buildLocalModelPromptForVariation(labels, "familiar");
}
export function buildLocalModelPromptForVariation(labels: readonly string[], variation: VariationMode) {
  const preference = variation === "familiar" ? "favor common major and minor triads and simpler sounds"
    : variation === "richer" ? "favor seventh chords and suspended colors"
      : "favor a wider mix of supported chord qualities and more varied root motion";
  return LOCAL_MODEL_PROMPT_TEMPLATE.replace("{selected vibe labels}", labels.join("\n"))
    .replace("{variation mode}", `${variation}; ${preference}`);
}
export function selectProgressionCandidate(rawCandidates: readonly unknown[], variation: VariationMode,
  allowBlues = false, resolver: typeof resolveProgression = resolveProgression): { chords: string[]; usableCandidates: number } | null {
  const survivors: { chords: string[]; rank: readonly number[]; index: number }[] = [];
  const seen = new Set<string>();
  for (const [index, rawCandidate] of rawCandidates.entries()) {
    const candidate = candidateSchema.safeParse(rawCandidate);
    if (!candidate.success || candidate.data.chords.some((symbol) => typeof symbol !== "string" || !chordSymbols.includes(symbol as typeof chordSymbols[number]))) continue;
    const parsed = progressionSchema.safeParse({ chords: candidate.data.chords });
    if (!parsed.success || parsed.data.chords.some((symbol, index) => symbol !== candidate.data.chords[index]) || new Set(parsed.data.chords).size < 2) continue;
    const key = JSON.stringify(parsed.data.chords);
    if (seen.has(key)) continue;
    const resolved = resolver(parsed.data.chords);
    if (!resolved || resolved.some((card, index) => card.symbol !== parsed.data.chords[index] || card.voicings.length === 0)) continue;
    const harmony = assessProgressionHarmony(parsed.data.chords, allowBlues);
    if (!harmony.coherent) continue;
    seen.add(key);
    const catalog = parsed.data.chords.map((symbol) => SUPPORTED_CHORDS.find((chord) => chord.symbol === symbol)!);
    const triads = catalog.filter((chord) => chord.suffix === "" || chord.suffix === "m").length;
    const colors = catalog.filter((chord) => ["7", "maj7", "m7", "sus2", "sus4"].includes(chord.suffix)).length;
    const uniqueQualities = new Set(catalog.map((chord) => chord.suffix)).size;
    const uniqueRoots = new Set(catalog.map((chord) => chord.pitchClass)).size;
    const distinctChords = new Set(parsed.data.chords).size;
    const rootMotions = catalog.slice(1).map((chord, motionIndex) =>
      (chord.pitchClass - catalog[motionIndex]!.pitchClass + 12) % 12);
    const distinctRootMotions = new Set(rootMotions).size;
    const rank = variation === "familiar" ? [triads, distinctChords]
      : variation === "richer" ? [colors, distinctChords]
        : [uniqueQualities + distinctRootMotions, uniqueRoots, distinctChords];
    survivors.push({ chords: parsed.data.chords, rank, index });
  }
  survivors.sort((a, b) => {
    for (let i = 0; i < Math.max(a.rank.length, b.rank.length); i++) {
      const difference = (b.rank[i] ?? 0) - (a.rank[i] ?? 0);
      if (difference !== 0) return difference;
    }
    return a.index - b.index;
  });
  const selected = survivors[0];
  return selected ? { chords: selected.chords, usableCandidates: survivors.length } : null;
}
const envelopeSchema = z.object({
  message: z.object({ role: z.literal("assistant"), content: z.string() }),
  done: z.literal(true),
  done_reason: z.literal("stop"),
  load_duration: z.number().finite().nonnegative(),
  prompt_eval_count: z.number().int().nonnegative(),
  eval_count: z.number().int().nonnegative(),
  eval_duration: z.number().finite().nonnegative(),
});

export function getLocalModelConfig(options: Pick<GenerationOptions, "model" | "baseUrl"> = {}) {
  const model = options.model ?? process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b";
  const baseUrl = options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new LocalModelError("configuration"); }
  const localEndpoint = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal|ollama)(?::[0-9]+)?\/?$/i;
  if (!localEndpoint.test(baseUrl) || url.protocol !== "http:" || url.username || url.password ||
    url.search || url.hash || url.pathname !== "/" || baseUrl.includes("?") || baseUrl.includes("#") ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(model) || /cloud/i.test(model)) {
    throw new LocalModelError("configuration");
  }
  return { model, baseUrl: url.origin };
}

function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { throw new LocalModelError("invalid_output"); }
}

export async function generateLocalProgression(vibeIds: readonly string[], options: GenerationOptions = {}): Promise<{
  chords: string[];
  metrics: { wallMs: number; loadMs: number; promptTokens: number; outputTokens: number; generationMs: number; requestedCandidates: number; usableCandidates: number };
}> {
  const request = progressionRequestSchema.safeParse({ vibeIds });
  const labels = request.success ? getVibeLabels(request.data.vibeIds) : null;
  if (!labels) throw new LocalModelError("invalid_input");
  const config = getLocalModelConfig(options);
  if (options.seed !== undefined && !Number.isSafeInteger(options.seed)) throw new LocalModelError("configuration");
  const variation = options.variation ?? "familiar";
  if (!["familiar", "richer", "adventurous"].includes(variation)) throw new LocalModelError("configuration");
  if (options.signal?.aborted) throw new LocalModelError("timeout");

  const started = performance.now();
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let rejectAbort: (reason: LocalModelError) => void = () => {};
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => {
    rejectAbort(new LocalModelError("timeout"));
    controller.abort();
    void reader?.cancel().catch(() => {});
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, DEADLINE_MS);
  const bounded = <T>(operation: Promise<T>) => Promise.race([operation, aborted]);
  try {
    const response = await bounded(fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        stream: false,
        think: false,
        keep_alive: "5m",
        options: { temperature: 0.2, num_ctx: 2048, num_predict: OUTPUT_TOKENS, ...(options.seed === undefined ? {} : { seed: options.seed }) },
        format: { type: "object", properties: { candidates: { type: "array", minItems: 1, maxItems: 3, items: { type: "object", properties: { chords: { type: "array", items: { type: "string", enum: chordSymbols }, minItems: 3, maxItems: 6 } }, required: ["chords"], additionalProperties: false } } }, required: ["candidates"], additionalProperties: false },
        messages: [{ role: "user", content: buildLocalModelPromptForVariation(labels, variation) }],
      }),
    }));
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new LocalModelError("unavailable");
    }
    reader = response.body?.getReader();
    if (!reader) throw new LocalModelError("invalid_output");
    if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
      void reader.cancel().catch(() => {});
      throw new LocalModelError("invalid_output");
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await bounded(reader.read());
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => {});
        throw new LocalModelError("invalid_output");
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let raw: string;
    try { raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new LocalModelError("invalid_output"); }
    const envelope = envelopeSchema.safeParse(parseJson(raw));
    if (!envelope.success) throw new LocalModelError("invalid_output");
    const candidateOutput = candidateEnvelopeSchema.safeParse(parseJson(envelope.data.message.content));
    if (!candidateOutput.success) throw new LocalModelError("invalid_output");
    const allowBlues = labels.includes("genre: Blues");
    const selected = selectProgressionCandidate(candidateOutput.data.candidates, variation, allowBlues);
    if (!selected) throw new LocalModelError("invalid_output");
    return {
      chords: selected.chords,
      metrics: { wallMs: performance.now() - started, loadMs: envelope.data.load_duration / 1_000_000,
        promptTokens: envelope.data.prompt_eval_count, outputTokens: envelope.data.eval_count,
        generationMs: envelope.data.eval_duration / 1_000_000, requestedCandidates: REQUESTED_CANDIDATES, usableCandidates: selected.usableCandidates },
    };
  } catch (cause) {
    if (controller.signal.aborted) throw new LocalModelError("timeout");
    if (cause instanceof LocalModelError) throw cause;
    throw new LocalModelError("unavailable");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    reader?.releaseLock();
  }
}
