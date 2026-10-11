import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { createHash } from "node:crypto";
import { z } from "zod";
import { generateLocalProgression, getLocalModelConfig, LOCAL_MODEL_PROMPT_TEMPLATE, LocalModelError } from "../lib/server/local-model";
import { CASES } from "./cases";
import { aggregate, chooseWinner, scoreProgression, type Sample } from "./scoring";

export const LIMITATIONS = "Automatic tonal-coherence and vibe checks are transparent proxies, not human judgments. Borrowed harmony may fail the common-scale heuristic. These checks do not replace listening or a human vibe assessment. Benchmarks apply only to this shortlist and hardware. First request is not cold: no model is unloaded. Ollama residency estimates are not process RSS or total system memory.";
export type CliOptions = { models: string[]; runs: number; out: string };
export function parseArgs(args: readonly string[]): CliOptions {
  const options = { models: ["qwen2.5:0.5b-instruct-q4_K_M", "qwen2.5:1.5b-instruct-q4_K_M", "qwen3:4b-q4_K_M", "qwen3.5:2b-nvfp4", "granite4:micro"], runs: 3, out: "evals/output/benchmark.json" };
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]; const value = args[i + 1];
    if (!flag || !["--models", "--runs", "--out"].includes(flag) || seen.has(flag) || !value?.trim() || value.startsWith("--")) throw new Error("Usage: --models <comma-separated IDs> --runs <positive integer> --out <path>");
    seen.add(flag);
    if (flag === "--models") {
      options.models = value.split(",").map(s => s.trim());
      if (new Set(options.models).size !== options.models.length) throw new Error("Duplicate model IDs.");
      for (const model of options.models) getLocalModelConfig({model});
    }
    if (flag === "--runs") {
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 100) throw new Error("Runs must be an integer from 1 to 100.");
      options.runs = Number(value);
    }
    if (flag === "--out") options.out = value;
  }
  return options;
}

const details = z.object({ parameter_size: z.string().optional(), quantization_level: z.string().optional() });
const installedSchema = z.object({ models: z.array(z.object({name: z.string(), digest: z.string(), size: z.number().nonnegative(), details: details.optional()})) });
const loadedSchema = z.object({ models: z.array(z.object({ name: z.string(), digest: z.string(), size: z.number().nonnegative(), size_vram: z.number().nonnegative(), expires_at: z.string().optional() })) });
const showSchema = z.object({details: details.optional(), model_info: z.record(z.string(), z.unknown()).optional()});
const versionSchema = z.object({version: z.string().min(1)});
async function localJson(baseUrl: string, path: string, model?: string): Promise<unknown> {
  const signal = AbortSignal.timeout(5_000);
  const response = await fetch(`${baseUrl}${path}`, { signal, redirect: "error", ...(model ? {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({model})} : {}) });
  if (!response.ok) { void response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing metadata body.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 4 * 1024 * 1024) { void reader.cancel(); throw new Error("Metadata exceeds 4 MiB."); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function inspectModel(model: string, baseUrl: string) {
  // Ollama defaults an untagged final path segment to :latest; registry ports are not tags.
  const modelName = model.lastIndexOf(":") > model.lastIndexOf("/") ? model : `${model}:latest`;
  const metadata: { installed?: z.infer<typeof installedSchema>["models"][number] | undefined; show?: z.infer<typeof showSchema>; loaded?: z.infer<typeof loadedSchema>["models"][number] | undefined; errors: string[] } = { errors: [] };
  // Metadata requests are also sequential and bounded; they never pull or unload.
  try { metadata.installed = installedSchema.parse(await localJson(baseUrl, "/api/tags")).models.find(m => m.name === modelName); }
  catch (cause) { metadata.errors.push(`tags: ${String(cause)}`); }
  try { metadata.show = showSchema.parse(await localJson(baseUrl, "/api/show", modelName)); }
  catch (cause) { metadata.errors.push(`show: ${String(cause)}`); }
  try { metadata.loaded = loadedSchema.parse(await localJson(baseUrl, "/api/ps")).models.find(m => m.name === modelName); }
  catch (cause) { metadata.errors.push(`ps: ${String(cause)}`); }
  return metadata;
}
async function inspectOllamaVersion(baseUrl: string): Promise<string | null> {
  try { return versionSchema.parse(await localJson(baseUrl, "/api/version")).version; }
  catch { return null; }
}
type Inspection = Awaited<ReturnType<typeof inspectModel>> | { error: string };
type Dependencies = { generate: typeof generateLocalProgression; inspect: (model: string, baseUrl: string) => Promise<Inspection> };
export async function runBenchmark(options: CliOptions, deps: Dependencies = { generate: generateLocalProgression, inspect: inspectModel }) {
  const models: { model: string; metadataBefore: Inspection; metadataAfter: Inspection; samples: Sample[]; summary: ReturnType<typeof aggregate> }[] = [];
  const baseUrl = getLocalModelConfig().baseUrl;
  const ollamaVersion = await inspectOllamaVersion(baseUrl);
  for (const model of options.models) {
    const config = getLocalModelConfig({model, baseUrl});
    const metadataBefore = await deps.inspect(model, config.baseUrl);
    const samples: Sample[] = [];
    const record = async (fixture: (typeof CASES)[number], phase: Sample["phase"], seed: number) => {
      const started = performance.now();
      try {
        const result = await deps.generate(fixture.vibeIds, {...config, seed});
        samples.push({kind: "accepted", phase, caseId: fixture.id, seed, ...result, score: scoreProgression(fixture, result.chords)});
      } catch (cause) {
        samples.push({kind: "failed", phase, caseId: fixture.id, seed, wallMs: performance.now() - started, error: cause instanceof LocalModelError ? cause.code : String(cause)});
      }
    };
    const first = CASES[0]; if (!first) throw new Error("Eval corpus must not be empty.");
    await record(first, "first-request", 4240);
    await record(first, "discarded-warmup", 4241);
    for (const fixture of CASES) {
      for (let repetition = 0; repetition < options.runs; repetition++) await record(fixture, "scored", 4242 + repetition);
    }
    const metadataAfter = await deps.inspect(model, config.baseUrl);
    const loadedBytes = "loaded" in metadataAfter ? metadataAfter.loaded?.size ?? null : null;
    models.push({ model, metadataBefore, metadataAfter, samples, summary: aggregate(model, samples, loadedBytes) });
  }
  return { schemaVersion: 1, createdAt: new Date().toISOString(), limitations: LIMITATIONS,
    ollama: { version: ollamaVersion }, prompt: { templateSha256: createHash("sha256").update(LOCAL_MODEL_PROMPT_TEMPLATE).digest("hex") },
    hardware: { platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, systemMemoryBytes: totalmem(), node: process.version },
    settings: {baseUrl, temperature: 0.2, num_ctx: 2048, num_predict: 128, think: false, keep_alive: "5m", seeds: Array.from({length: options.runs}, (_, i) => 4242 + i), runs: options.runs, concurrency: 1, unloadingPerformed: false, percentileMethod: "nearest rank; scored requests including failures; first and warmup excluded"},
    gates: { validPlayableRate: 1, proxyPassRate: 0.8, distinctProgressions: 3 },
    proxyDefinitions: { minor: "At least one minor triad or minor seventh", "major-opening": "First chord is a major triad, major seventh or dominant seventh", seventh: "At least one dominant, major or minor seventh", triads: "At least 75% major/minor triads", blues: "All chords dominant sevenths with exactly I, IV and V roots for some tonic", coherence: "At least 75% whole chords fit one common major or natural-minor pitch-class set; blues uses root relationship instead", variety: "At least two distinct chords per progression and three exact ordered chord arrays across the corpus" },
    corpus: CASES, models, winner: chooseWinner(models.map(m => m.summary)) };
}
export async function main(args: readonly string[]): Promise<number> {
  // Validate before any model request or output file creation.
  const options = parseArgs(args);
  const report = await runBenchmark(options);
  await mkdir(dirname(resolve(options.out)), {recursive: true});
  await writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`);
  console.info(LIMITATIONS);
  console.table(report.models.map(m => m.summary));
  console.info(`Winner: ${report.winner ?? "none"}. Results: ${options.out}`);
  return report.winner ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(cause => { console.error(String(cause)); process.exitCode = 2; });
}
