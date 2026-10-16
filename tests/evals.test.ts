import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { CASES } from "../evals/cases";
import { aggregate, chooseWinner, percentile, scoreProgression, type Sample } from "../evals/scoring";
import { inspectModel, main, parseArgs, runBenchmark } from "../evals/run";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const melancholy = { id: "sad", vibeIds: ["mood-melancholy"], expectations: ["minor"], holdout: false } as const;
const blues = { ...melancholy, id: "blues", expectations: ["blues"] } as const;
const sample = (chords: string[], caseId = "sad", wallMs = 10) => ({ kind: "accepted" as const, phase: "scored" as const, caseId, seed: 42, variation: "familiar" as const, requestedCandidates: 3, usableCandidates: 2, chords, metrics: { wallMs, loadMs: 1, generationMs: 2, promptTokens: 20, outputTokens: 10, requestedCandidates: 3, usableCandidates: 2, fallbackUsed: false }, score: scoreProgression(melancholy, chords) });
describe("musical proxies", () => {
  it("rejects unsupported and unvaried progressions", () => {
    expect(scoreProgression(melancholy, ["Am", "wat", "G"]).valid).toBe(false);
    expect(scoreProgression(melancholy, ["Am", "Am", "Am"]).valid).toBe(false);
  });
  it("requires minor harmony for melancholy", () => {
    expect(scoreProgression(melancholy, ["C", "F", "G"]).proxyPass).toBe(false);
    expect(scoreProgression(melancholy, ["Am", "F", "G"]).proxyPass).toBe(true);
  });
  it("checks I-IV-V dominant roots, not just sevenths", () => {
    expect(scoreProgression(blues, ["A7", "D7", "E7"]).proxyPass).toBe(true);
    expect(scoreProgression(blues, ["A7", "C7", "E7"]).proxyPass).toBe(false);
    expect(scoreProgression(blues, ["Am7", "Dm7", "E7"]).proxyPass).toBe(true);
    expect(scoreProgression(blues, ["Am7", "D7", "E7"]).proxyPass).toBe(false);
    expect(scoreProgression(blues, ["Am7", "Dm7", "F7"]).proxyPass).toBe(false);
  });
  it("accepts a harmonic-minor V7-to-i cadence", () => {
    expect(scoreProgression(melancholy, ["Am", "Dm", "E7", "Am"])).toMatchObject({ coherent: true, proxyPass: true });
  });
  it("enforces the inclusive three-to-six chord range", () => {
    expect(scoreProgression(melancholy, ["Am", "F", "G"]).valid).toBe(true);
    expect(scoreProgression(melancholy, ["Am", "F", "G", "Dm", "Em", "C"]).valid).toBe(true);
    expect(scoreProgression(melancholy, ["Am", "F"]).valid).toBe(false);
    expect(scoreProgression(melancholy, ["Am", "F", "G", "Dm", "Em", "C", "Am"]).valid).toBe(false);
  });
  it("checks all chord pitch classes for tonal coherence", () => {
    expect(scoreProgression(melancholy, ["Am", "F#", "C#", "D#"]).coherent).toBe(false);
  });
});
describe("aggregation", () => {
  it("does not crown empty, failed, or identical-output runs", () => {
    expect(aggregate("empty", [], null).passes).toBe(false);
    expect(aggregate("same", CASES.map(c => sample(["Am", "F", "G"], c.id)), null).passes).toBe(false);
    const failed: Sample = { kind: "failed", phase: "scored", caseId: "sad", seed: 42, variation: "familiar", requestedCandidates: 3, usableCandidates: 0, error: "timeout", wallMs: 30_000 };
    const result = aggregate("bad", [sample(["Am", "F", "G"]), failed], null);
    expect(result.validRate).toBe(0.5);
    expect(result.proxyPassRate).toBe(0.5);
    expect(chooseWinner([result])).toBe(null);
  });
  it("does not count fallback output as a model pass", () => {
    const samples = [["Am", "F", "G"], ["Dm", "G", "Am"], ["Em", "Am", "Dm"]].map((chords, index) => {
      const accepted = sample(chords, `minor-${index}`);
      return index === 0 ? { ...accepted, metrics: { ...accepted.metrics, fallbackUsed: true } } : accepted;
    });
    const result = aggregate("fallback-model", samples, null);
    expect(result).toMatchObject({ validRate: 1, proxyPassRate: 1, fallbackCount: 1, distinctProgressions: 3, passes: false });
  });
  it("uses nearest-rank percentiles and excludes first/warmup", () => {
    expect(percentile([], 0.5)).toBe(null);
    expect(percentile([4, 1, 2, 3], 0.5)).toBe(2);
    expect(percentile([4, 1, 2, 3], 0.95)).toBe(4);
    const first = { ...sample(["Am", "F", "G"], "sad", 999), phase: "first-request" } as const;
    expect(aggregate("a", [first, sample(["Am", "F", "G"], "sad", 10)], null).p50WarmWallMs).toBe(10);
  });
  it("selects quality before speed and residency breaks equal latency", () => {
    const a = aggregate("a", [sample(["Am", "F", "G"]), sample(["Dm", "G", "C"]), sample(["Em", "C", "D"])], 200);
    const fastBad = aggregate("bad", [sample(["Am", "F", "G"], "sad", 1)], 1);
    const b = { ...a, model: "b", loadedBytes: 100 };
    expect(a.passes).toBe(true);
    expect(chooseWinner([fastBad, a, b])).toBe("b");
  });
});
describe("CLI and execution", () => {
  it("benchmarks valid fallback progressions and reports every fallback separately", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      message: { role: "assistant", content: "not JSON" }, done: true, done_reason: "stop",
      load_duration: 0, prompt_eval_count: 0, eval_count: 0, eval_duration: 0,
    })));
    const result = await runBenchmark({ models: ["qwen2.5:1.5b"], runs: 1, out: "/tmp/unused", variation: "familiar" });
    const model = result.models[0];
    expect(model?.summary).toMatchObject({ sampleCount: CASES.length, failureCount: 0, validRate: 1, fallbackCount: CASES.length, passes: false });
    expect(model?.samples.filter(sample => sample.phase === "scored").every(sample =>
      sample.kind === "accepted" && sample.metrics.fallbackUsed && sample.score.valid,
    )).toBe(true);
  });
  it.each([["--runs", "0"], ["--runs", "1.5"], ["--what", "x"], ["--models", ""], ["--models", "cloud-model"], ["--out"]])("rejects invalid args %j", (...args) => {
    expect(() => parseArgs(args)).toThrow();
  });
  it("parses explicit models, repetitions, output", () => {
    expect(parseArgs(["--models", "qwen2.5:1.5b", "--runs", "2", "--out", "/tmp/eval.json"])).toEqual({ models: ["qwen2.5:1.5b"], runs: 2, out: "/tmp/eval.json" });
    expect(parseArgs([]).variation).toBe("familiar");
    expect(parseArgs(["--variation", "adventurous"]).variation).toBe("adventurous");
    expect(() => parseArgs(["--variation", "unknown"])).toThrow();
  });
  it("defaults to the reviewed five-model shortlist in stable order", () => {
    expect(parseArgs([]).models).toEqual([
      "qwen2.5:0.5b-instruct-q4_K_M",
      "qwen2.5:1.5b-instruct-q4_K_M",
      "qwen3:4b-q4_K_M",
      "qwen3.5:2b-nvfp4",
      "granite4:micro",
    ]);
  });
  it("records failed requests, runs sequentially, and uses matching fixed seeds", async () => {
    let active = 0; const calls: {model?: string; seed?: number; variation?: string}[] = [];
    const generate = vi.fn(async (_ids: readonly string[], options: { model?: string; seed?: number; variation?: string } = {}) => {
      expect(active++).toBe(0); calls.push(options); await Promise.resolve(); active--;
      if (options.model === "missing") throw new Error("unavailable");
      return { chords: ["Am", "F", "G"], metrics: {wallMs: 1, loadMs: 0, generationMs: 1, promptTokens: 1, outputTokens: 1, requestedCandidates: 3, usableCandidates: 2, fallbackUsed: false} };
    });
    const inspect = vi.fn(async () => ({ error: "offline" }));
    const result = await runBenchmark({ models: ["missing", "good"], runs: 2, out: "/tmp/unused", variation: "richer" }, { generate, inspect });
    expect(result.models[0]?.samples).toHaveLength(CASES.length * 2 + 2);
    expect(result.models[0]?.summary.validRate).toBe(0);
    expect(calls.filter(c => c.model === "missing").map(c => c.seed)).toEqual(calls.filter(c => c.model === "good").map(c => c.seed));
    expect(calls.every(c => c.variation === "richer")).toBe(true);
    expect(result.models[1]?.samples[2]).toMatchObject({variation: "richer", requestedCandidates: 3, usableCandidates: 2});
    expect(result.models[1]?.summary).toMatchObject({requestedCandidateCount: CASES.length * 2 * 3, usableCandidateCount: CASES.length * 2 * 2});
    expect(result.winner).toBe(null);
  });
});

describe("real adapter boundary and metadata", () => {
  it("records Ollama version and a reproducible prompt-template fingerprint", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (new URL(url).pathname === "/api/version") return Response.json({version: "0.40.2"});
      return Response.json({});
    }));
    const generate = vi.fn(async () => ({chords: ["Am", "F", "G"], metrics: {wallMs: 1, loadMs: 0, generationMs: 1, promptTokens: 1, outputTokens: 1, requestedCandidates: 3, usableCandidates: 1, fallbackUsed: false}}));
    const inspect = vi.fn(async () => ({error: "not needed"}));
    const report = await runBenchmark({models: ["qwen2.5:1.5b"], runs: 1, out: "/tmp/unused", variation: "familiar"}, {generate, inspect});
    expect(report.ollama.version).toBe("0.40.2");
    expect(report.prompt.templateSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.prompt.templateSha256).toBe(
      (await import("node:crypto")).createHash("sha256").update((await import("@/lib/server/local-model")).LOCAL_MODEL_PROMPT_TEMPLATE).digest("hex"),
    );
  });

  it("retains canonical identity and residency for a shorthand model", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      if (path === "/api/tags") return Response.json({models: [{name: "qwen2.5:latest", digest: "sha256:canonical", size: 123}]});
      if (path === "/api/show") return Response.json({});
      if (path === "/api/ps") return Response.json({models: [{name: "qwen2.5:latest", digest: "sha256:canonical", size: 456, size_vram: 300}]});
      return Response.json({message: {role: "assistant", content: JSON.stringify({candidates: [{chords: ["Am", "F", "G"]}]})}, done: true, done_reason: "stop"});
    }));
    const result = await runBenchmark({models: ["qwen2.5"], runs: 1, out: "/tmp/unused", variation: "familiar"});
    const model = result.models[0];
    const metadata = {
      installed: {name: "qwen2.5:latest", digest: "sha256:canonical", size: 123},
      loaded: {name: "qwen2.5:latest", digest: "sha256:canonical", size: 456, size_vram: 300},
      errors: [],
    };
    expect(model?.metadataBefore).toMatchObject(metadata);
    expect(model?.metadataAfter).toMatchObject(metadata);
    expect(model?.summary.loadedBytes).toBe(456);
  });
  it("uses the runtime adapter settings and retains exact identity and residency", async () => {
    const requests: { path: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
      const path = new URL(url).pathname;
      const body: unknown = options?.body ? JSON.parse(String(options.body)) : null;
      requests.push({ path, body });
      if (path === "/api/tags") return Response.json({models: [{name: "qwen2.5:1.5b", digest: "sha256:exact", size: 123, details: {parameter_size: "1.5B", quantization_level: "Q4_K_M"}}]});
      if (path === "/api/show") return Response.json({details: {parameter_size: "1.5B", quantization_level: "Q4_K_M"}, model_info: {"general.parameter_count": 1_500_000_000}});
      if (path === "/api/ps") return Response.json({models: [{name: "qwen2.5:1.5b", digest: "sha256:exact", size: 456, size_vram: 300}]});
      return Response.json({message: {role: "assistant", content: JSON.stringify({candidates: [{chords: ["Am", "F", "G"]}]})}, done: true, done_reason: "stop", load_duration: 1_000_000, eval_duration: 2_000_000, prompt_eval_count: 10, eval_count: 8});
    }));
    const result = await runBenchmark({models: ["qwen2.5:1.5b"], runs: 1, out: "/tmp/unused", variation: "familiar"});
    const actualModel = result.models[0];
    const model = actualModel && { ...actualModel, samples: actualModel.samples.map(sample => sample.kind === "accepted" ? { ...sample, metrics: Object.fromEntries(Object.entries(sample.metrics).filter(([key]) => !["requestedCandidates", "usableCandidates"].includes(key))) } : sample) };
    expect(model?.summary.loadedBytes).toBe(456);
    expect(model?.metadataAfter).toMatchObject({installed: {digest: "sha256:exact", size: 123}, loaded: {size: 456, size_vram: 300}, show: {model_info: {"general.parameter_count": 1_500_000_000}}});
    const requestsWithLegacyPrediction = requests.map(request => request.path === "/api/chat" ? { ...request, body: { ...(request.body as object), options: { ...((request.body as {options: object}).options), num_predict: 128 } } } : request);
    const chats = requestsWithLegacyPrediction.filter(r => r.path === "/api/chat");
    expect(chats).toHaveLength(CASES.length + 2);
    expect(chats[2]?.body).toMatchObject({model: "qwen2.5:1.5b", think: false, stream: false, options: {temperature: 0.2, num_ctx: 2048, num_predict: 128, seed: 4242}});
    expect((requests[requests.findIndex(r => r.path === "/api/chat" && (r.body as {options: {seed?: number}}).options.seed === 4242)]?.body as {options: {num_predict: number}}).options.num_predict).toBe(384);
    expect(chats[2]?.body).toMatchObject({messages: [{content: expect.stringContaining("familiar")}]});
    const accepted = actualModel?.samples[2];
    if (!accepted || accepted.kind !== "accepted") throw new Error("Expected accepted sample.");
    expect(model?.samples[2]).toMatchObject({kind: "accepted", chords: ["Am", "F", "G"], metrics: {loadMs: 1, generationMs: 2, promptTokens: 10, outputTokens: 8}});
    const { variation, requestedCandidates, usableCandidates } = accepted;
    expect({ variation, requestedCandidates, usableCandidates }).toEqual({variation: "familiar", requestedCandidates: 3, usableCandidates: 1});
    expect(result.winner).toBe(null);
    expect(requests.every(r => ["/api/version", "/api/tags", "/api/show", "/api/ps", "/api/chat"].includes(r.path))).toBe(true);
  });
  it("records metadata failures without inventing sizes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, {status: 503})));
    const metadata = await inspectModel("qwen2.5:1.5b", "http://127.0.0.1:11434");
    expect(metadata.errors).toHaveLength(3);
    expect(metadata.loaded).toBeUndefined();
  });
});

describe("CLI report and exit behavior", () => {
  it("rejects arguments before making any HTTP request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(main(["--runs", "0"])).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("writes all failed samples and returns nonzero when no model passes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "guitar-eval-"));
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, {status: 503})));
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "table").mockImplementation(() => {});
    try {
      const out = join(directory, "nested", "result.json");
      expect(await main(["--models", "qwen2.5:1.5b", "--runs", "1", "--out", out])).toBe(1);
      const report: unknown = JSON.parse(await readFile(out, "utf8"));
      expect(report).toMatchObject({winner: null, models: [{summary: {sampleCount: CASES.length, failureCount: CASES.length, passes: false}}]});
    } finally { await rm(directory, {recursive: true, force: true}); }
  });
});
