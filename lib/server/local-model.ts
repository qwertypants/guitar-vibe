import "server-only";
import { z } from "zod";
import { SUPPORTED_CHORDS } from "@/lib/chords";
import { getVibeLabels, progressionRequestSchema, progressionSchema, resolveProgression } from "@/lib/progression";

export type LocalModelErrorCode = "invalid_input" | "configuration" | "unavailable" | "timeout" | "invalid_output";
export class LocalModelError extends Error {
  constructor(public readonly code: LocalModelErrorCode) {
    super(code);
    this.name = "LocalModelError";
  }
}

type GenerationOptions = { model?: string; baseUrl?: string; seed?: number; signal?: AbortSignal };
const MAX_RESPONSE_BYTES = 64 * 1024;
const DEADLINE_MS = 30_000;
const chordSymbols = SUPPORTED_CHORDS.map(({ symbol }) => symbol);
const outputSchema = z.object({ chords: z.array(z.enum(chordSymbols)).min(3).max(6) }).strict();
export const LOCAL_MODEL_PROMPT_TEMPLATE = [
  "Create a coherent, playable guitar chord progression inspired by these selected vibes:",
  "{selected vibe labels}",
  "Return 3 to 6 chord symbols, with at least two distinct chords. Use one tonal center and common diatonic triads or seventh chords; at least 75% of chords should fit one major or minor scale.",
  "Mood and genre are style cues, not universal theory rules. Use them to guide character while keeping the harmony coherent.",
  "A minor-key dominant seventh on scale degree V may resolve to minor i as a harmonic-minor V7-to-i cadence. Blues may use a major pattern of dominant-7 I, IV, and V, or a minor pattern of minor-7 i and iv with dominant-7 V.",
  "Prefer smooth guitar voice leading. Return only the required JSON using symbols from the supported chord catalog; the app supplies playable guitar voicings.",
].join("\n");
export function buildLocalModelPrompt(labels: readonly string[]) {
  return LOCAL_MODEL_PROMPT_TEMPLATE.replace("{selected vibe labels}", labels.join("\n"));
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
  metrics: { wallMs: number; loadMs: number; promptTokens: number; outputTokens: number; generationMs: number };
}> {
  const request = progressionRequestSchema.safeParse({ vibeIds });
  const labels = request.success ? getVibeLabels(request.data.vibeIds) : null;
  if (!labels) throw new LocalModelError("invalid_input");
  const config = getLocalModelConfig(options);
  if (options.seed !== undefined && !Number.isSafeInteger(options.seed)) throw new LocalModelError("configuration");
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
        options: { temperature: 0.2, num_ctx: 2048, num_predict: 128, ...(options.seed === undefined ? {} : { seed: options.seed }) },
        format: { type: "object", properties: { chords: { type: "array", items: { type: "string", enum: chordSymbols }, minItems: 3, maxItems: 6 } }, required: ["chords"], additionalProperties: false },
        messages: [{ role: "user", content: buildLocalModelPrompt(labels) }],
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
    const exactOutput = outputSchema.safeParse(parseJson(envelope.data.message.content));
    if (!exactOutput.success) throw new LocalModelError("invalid_output");
    const output = progressionSchema.safeParse(exactOutput.data);
    if (!output.success || new Set(output.data.chords).size < 2 || !resolveProgression(output.data.chords)) {
      throw new LocalModelError("invalid_output");
    }
    return {
      chords: output.data.chords,
      metrics: { wallMs: performance.now() - started, loadMs: envelope.data.load_duration / 1_000_000,
        promptTokens: envelope.data.prompt_eval_count, outputTokens: envelope.data.eval_count,
        generationMs: envelope.data.eval_duration / 1_000_000 },
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
