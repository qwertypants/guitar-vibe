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
const sample = (chords: string[], caseId = "sad", wallMs = 10): Sample => ({ kind: "accepted", phase: "scored", caseId, seed: 42, chords, metrics: { wallMs, loadMs: 1, generationMs: 2, promptTokens: 20, outputTokens: 10 }, score: scoreProgression(melancholy, chords) });
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
  });
  it("checks all chord pitch classes for tonal coherence", () => {
    expect(scoreProgression(melancholy, ["Am", "F#", "C#", "D#"]).coherent).toBe(false);
  });
});
describe("aggregation", () => {
  it("does not crown empty, failed, or identical-output runs", () => {
    expect(aggregate("empty", [], null).passes).toBe(false);
    expect(aggregate("same", CASES.map(c => sample(["Am", "F", "G"], c.id)), null).passes).toBe(false);
    const failed: Sample = { kind: "failed", phase: "scored", caseId: "sad", seed: 42, error: "timeout", wallMs: 30_000 };
    const result = aggregate("bad", [sample(["Am", "F", "G"]), failed], null);
    expect(result.validRate).toBe(0.5);
    expect(result.proxyPassRate).toBe(0.5);
    expect(chooseWinner([result])).toBe(null);
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
  it.each([["--runs", "0"], ["--runs", "1.5"], ["--what", "x"], ["--models", ""], ["--models", "cloud-model"], ["--out"]])("rejects invalid args %j", (...args) => {
    expect(() => parseArgs(args)).toThrow();
  });
  it("parses explicit models, repetitions, output", () => {
    expect(parseArgs(["--models", "qwen2.5:1.5b", "--runs", "2", "--out", "/tmp/eval.json"])).toEqual({ models: ["qwen2.5:1.5b"], runs: 2, out: "/tmp/eval.json" });
  });
  it("records failed requests, runs sequentially, and uses matching fixed seeds", async () => {
    let active = 0; const calls: {model?: string; seed?: number}[] = [];
    const generate = vi.fn(async (_ids: readonly string[], options: { model?: string; seed?: number } = {}) => {
      expect(active++).toBe(0); calls.push(options); await Promise.resolve(); active--;
      if (options.model === "missing") throw new Error("unavailable");
      return { chords: ["Am", "F", "G"], metrics: {wallMs: 1, loadMs: 0, generationMs: 1, promptTokens: 1, outputTokens: 1} };
    });
    const inspect = vi.fn(async () => ({ error: "offline" }));
    const result = await runBenchmark({ models: ["missing", "good"], runs: 2, out: "/tmp/unused" }, { generate, inspect });
    expect(result.models[0]?.samples).toHaveLength(CASES.length * 2 + 2);
    expect(result.models[0]?.summary.validRate).toBe(0);
    expect(calls.filter(c => c.model === "missing").map(c => c.seed)).toEqual(calls.filter(c => c.model === "good").map(c => c.seed));
    expect(result.winner).toBe(null);
  });
});

describe("real adapter boundary and metadata", () => {
  it("uses the runtime adapter settings and retains exact identity and residency", async () => {
    const requests: { path: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
      const path = new URL(url).pathname;
      const body: unknown = options?.body ? JSON.parse(String(options.body)) : null;
      requests.push({ path, body });
      if (path === "/api/tags") return Response.json({models: [{name: "qwen2.5:1.5b", digest: "sha256:exact", size: 123, details: {parameter_size: "1.5B", quantization_level: "Q4_K_M"}}]});
      if (path === "/api/show") return Response.json({details: {parameter_size: "1.5B", quantization_level: "Q4_K_M"}, model_info: {"general.parameter_count": 1_500_000_000}});
      if (path === "/api/ps") return Response.json({models: [{name: "qwen2.5:1.5b", digest: "sha256:exact", size: 456, size_vram: 300}]});
      return Response.json({message: {role: "assistant", content: JSON.stringify({chords: ["Am", "F", "G"]})}, done: true, done_reason: "stop", load_duration: 1_000_000, eval_duration: 2_000_000, prompt_eval_count: 10, eval_count: 8});
    }));
    const result = await runBenchmark({models: ["qwen2.5:1.5b"], runs: 1, out: "/tmp/unused"});
    const model = result.models[0];
    expect(model?.summary.loadedBytes).toBe(456);
    expect(model?.metadataAfter).toMatchObject({installed: {digest: "sha256:exact", size: 123}, loaded: {size: 456, size_vram: 300}, show: {model_info: {"general.parameter_count": 1_500_000_000}}});
    const chats = requests.filter(r => r.path === "/api/chat");
    expect(chats).toHaveLength(CASES.length + 2);
    expect(chats[2]?.body).toMatchObject({model: "qwen2.5:1.5b", think: false, stream: false, options: {temperature: 0.2, num_ctx: 2048, num_predict: 128, seed: 4242}});
    expect(model?.samples[2]).toMatchObject({kind: "accepted", chords: ["Am", "F", "G"], metrics: {loadMs: 1, generationMs: 2, promptTokens: 10, outputTokens: 8}});
    expect(result.winner).toBe(null);
    expect(requests.every(r => ["/api/tags", "/api/show", "/api/ps", "/api/chat"].includes(r.path))).toBe(true);
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
