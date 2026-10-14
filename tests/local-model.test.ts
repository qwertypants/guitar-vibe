// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { generateLocalProgression, LocalModelError, selectProgressionCandidate } from "@/lib/server/local-model";
import { SUPPORTED_CHORDS } from "@/lib/chords";
import { resolveProgression } from "@/lib/progression";

const ids = ["mood-melancholy", "genre-jazz"];
const chords = ["Am7", "Dm7", "G7", "Cmaj7"];
const candidateSet = (progressions: readonly (readonly string[])[]) => ({ candidates: progressions.map((chords) => ({ chords })) });
function envelope(content = JSON.stringify(candidateSet([chords])), extra = {}) {
  return { message: { role: "assistant", content }, done: true, done_reason: "stop", load_duration: 2_000_000,
    prompt_eval_count: 100, eval_count: 20, eval_duration: 10_000_000, ...extra };
}
const network = vi.fn<typeof fetch>();
beforeEach(() => { vi.stubGlobal("fetch", network); network.mockReset(); vi.stubEnv("OLLAMA_MODEL", "qwen2.5:1.5b"); vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("local generation", () => {
  it("uses one constrained request and returns validated chords and metrics", async () => {
    network.mockResolvedValue(Response.json(envelope()));
    const generated = await generateLocalProgression(ids, { seed: 42 });
    const { wallMs, loadMs, promptTokens, outputTokens, generationMs } = generated.metrics;
    const legacyMetrics = { wallMs, loadMs, promptTokens, outputTokens, generationMs };
    const result = { ...generated, metrics: legacyMetrics };
    expect(result.chords).toEqual(chords);
    expect(result.metrics).toEqual({ wallMs: expect.any(Number), loadMs: 2, promptTokens: 100, outputTokens: 20, generationMs: 10 });
    expect(generated.metrics).toMatchObject({ requestedCandidates: 3, usableCandidates: 1 });
    expect(network).toHaveBeenCalledTimes(1);
    const [url, init] = network.mock.calls[0]!;
    expect(String(url)).toBe("http://127.0.0.1:11434/api/chat");
    expect(init).toMatchObject({ method: "POST", redirect: "error", signal: expect.any(AbortSignal) });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: "qwen2.5:1.5b", stream: false, think: false, keep_alive: "5m",
      options: { temperature: 0.2, num_ctx: 2048, num_predict: 384, seed: 42 } });
    const candidateChordsSchema = body.format.properties.candidates.items.properties.chords;
    body.format.properties.chords = { ...candidateChordsSchema, items: { enum: candidateChordsSchema.items.enum } };
    expect(body.format.properties.chords.items.enum).toEqual(SUPPORTED_CHORDS.map(({ symbol }) => symbol));
    expect(body.format.properties.candidates).toMatchObject({ minItems: 1, maxItems: 3 });
    expect(body.format.properties.chords).toMatchObject({ minItems: 3, maxItems: 6 });
    expect(body.messages.map((message: { content: string }) => message.content).join(" ")).toContain("Melancholy");
  });
  it("gives explicit tonal and genre constraints without prescribing chord sequences", async () => {
    network.mockResolvedValue(Response.json(envelope()));
    await generateLocalProgression(ids);
    const [, init] = network.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));
    const prompt = body.messages.map((message: { content: string }) => message.content).join("\n");
    expect(prompt).toMatch(/one tonal center/i);
    expect(prompt).toMatch(/at least 75% of chords should fit one major or minor scale/i);
    expect(prompt).toMatch(/harmonic-minor V7-to-i/i);
    expect(prompt).toMatch(/major pattern of dominant-7 I, IV, and V, or a minor pattern/i);
    expect(prompt).toMatch(/app supplies playable guitar voicings/i);
    expect(prompt).not.toMatch(/Am7.*Dm7.*G7/i);
  });
  it.each([[], ["unknown"], ["mood-dark", "mood-dark"], ["mood-dark", "mood-joyful"], Array(6).fill("genre-jazz")])("rejects invalid selection %j before inference", async (selection) => {
    await expect(generateLocalProgression(selection)).rejects.toMatchObject({ code: "invalid_input" });
    expect(network).not.toHaveBeenCalled();
  });
  it.each(["https://localhost:11434", "http://example.com", "http://user:pass@localhost", "http://localhost/path", "http://localhost?x=1", "http://localhost#x", "not a url", "http://localhost/hidden/..", "http://@localhost", "http://localhost\n", "http://localhost?", "http://localhost#"]) ("rejects endpoint %s", async (baseUrl) => {
    await expect(generateLocalProgression(ids, { baseUrl })).rejects.toMatchObject({ code: "configuration" });
    expect(network).not.toHaveBeenCalled();
  });
  it.each(["localhost", "127.0.0.1", "[::1]", "host.docker.internal", "ollama"])("accepts local host %s", async (host) => {
    network.mockResolvedValue(Response.json(envelope()));
    await expect(generateLocalProgression(ids, { baseUrl: `http://${host}:11434/` })).resolves.toMatchObject({ chords });
  });
  it.each(["qwen:cloud", "qwen:7b-cloud", "qwen-cloud", "", "qwen\ncloud"])("rejects cloud/invalid model %j", async (model) => {
    await expect(generateLocalProgression(ids, { model })).rejects.toMatchObject({ code: "configuration" });
    expect(network).not.toHaveBeenCalled();
  });
  it.each(["not json", "```json\n{}\n```", JSON.stringify({ chords: "Am" }), JSON.stringify(candidateSet([["Am", "C"]])),
    JSON.stringify(candidateSet([Array(2).fill("Am")])), JSON.stringify(candidateSet([Array(7).fill("Am")])), JSON.stringify(candidateSet([["Am", "C", "G13"]])),
    JSON.stringify(candidateSet([["Am", "Am", "Am"]])), JSON.stringify(candidateSet([[" Am", "C", "G"]])),
    JSON.stringify({ candidates: [{ chords, voicings: [] }] })])("rejects malformed or invalid model content %s", async (content) => {
    network.mockResolvedValue(Response.json(envelope(content)));
    const result = generateLocalProgression(ids);
    await expect(result).rejects.toBeInstanceOf(LocalModelError);
    await expect(result).rejects.toMatchObject({ code: "invalid_output" });
    expect(network).toHaveBeenCalledOnce();
  });
  it.each([3, 6])("accepts inclusive %i chord outputs", async (count) => {
    const validChords = Array.from({ length: count }, (_, index) => ["Am", "C", "G", "F", "Dm", "Em"][index]!);
    network.mockResolvedValue(Response.json(envelope(JSON.stringify(candidateSet([validChords])))));
    await expect(generateLocalProgression(ids)).resolves.toMatchObject({ chords: validChords });
  });
  it.each([
    ["familiar", ["C", "F", "G"], ["C", "F", "G"]],
    ["richer", ["C", "F", "G"], ["Cmaj7", "Fmaj7", "G7"]],
    ["adventurous", ["C", "F", "G"], ["C", "Dsus4", "G7"]],
  ] as const)("selects the deterministic %s candidate", async (variation, first, expected) => {
    network.mockResolvedValue(Response.json(envelope(JSON.stringify(candidateSet([["C", "F", "G"], ["Cmaj7", "Fmaj7", "G7"], ["C", "Dsus4", "G7"]])))));
    const result = await generateLocalProgression(ids, { variation });
    expect(result.chords).toEqual(expected);
    expect(result.metrics).toMatchObject({ requestedCandidates: 3, usableCandidates: 3 });
    const body = JSON.parse(String(network.mock.calls[0]?.[1]?.body));
    expect(body.messages[0].content).toContain(variation);
  });
  it("filters malformed, duplicate, unsupported, and incoherent candidates, then safely falls back", async () => {
    const coherent = ["C", "F", "G"];
    network.mockResolvedValue(Response.json(envelope(JSON.stringify({ candidates: [
      null, { chords: ["C", "F", "G"], extra: true }, { chords: ["C", "F", "G"] },
    ] }))));
    const result = await generateLocalProgression(ids);
    expect(result.chords).toEqual(coherent);
    expect(result.metrics).toMatchObject({ requestedCandidates: 3, usableCandidates: 1 });
  });
  it("rejects output when no candidate is coherent and playable", async () => {
    network.mockResolvedValue(Response.json(envelope(JSON.stringify(candidateSet([["C", "F#", "C#", "D#"], ["C", "F", "G13"]])))));
    await expect(generateLocalProgression(ids)).rejects.toMatchObject({ code: "invalid_output" });
  });
  it("filters a canonical candidate when trusted voicing resolution fails", () => {
    const selected = selectProgressionCandidate(candidateSet([["Am", "F", "G"], ["C", "F", "G"]]).candidates,
      "familiar", false, (symbols) => symbols.includes("Am") ? null : resolveProgression(symbols));
    expect(selected).toEqual({ chords: ["C", "F", "G"], usableCandidates: 1 });
  });
  it("allows I-IV-V blues coherence only for a blues selection", () => {
    const candidates = candidateSet([["E7", "A7", "B7"]]).candidates;
    expect(selectProgressionCandidate(candidates, "familiar")).toBe(null);
    expect(selectProgressionCandidate(candidates, "familiar", true)).toEqual({ chords: ["E7", "A7", "B7"], usableCandidates: 1 });
  });
  it("enables blues coherence from the selected Blues catalog label", async () => {
    network.mockResolvedValue(Response.json(envelope(JSON.stringify(candidateSet([["E7", "A7", "B7"]])))));
    await expect(generateLocalProgression(["genre-blues"])).resolves.toMatchObject({ chords: ["E7", "A7", "B7"] });
    network.mockResolvedValue(Response.json(envelope(JSON.stringify(candidateSet([["E7", "A7", "B7"]])))));
    await expect(generateLocalProgression(["genre-jazz"])).rejects.toMatchObject({ code: "invalid_output" });
  });
  it.each([
    ["familiar", [["C", "C", "G", "G"], ["C", "F", "G", "C"]], ["C", "F", "G", "C"]],
    ["richer", [["Cmaj7", "Cmaj7", "G7", "G7"], ["Cmaj7", "Fmaj7", "G7", "Cmaj7"]], ["Cmaj7", "Fmaj7", "G7", "Cmaj7"]],
    ["adventurous", [["C", "Dm", "F", "G"], ["C", "Dm", "G", "F"]], ["C", "Dm", "G", "F"]],
  ] as const)("uses distinct chord vocabulary or ordered root motion for %s", (variation, options, expected) => {
    expect(selectProgressionCandidate(candidateSet([...options]).candidates, variation)?.chords).toEqual(expected);
    expect(selectProgressionCandidate(candidateSet([...options]).candidates, variation)?.chords).toEqual(expected);
  });
  it("keeps original candidate order when all ranking dimensions tie", () => {
    const options = [["C", "F", "G"], ["C", "G", "F"]];
    expect(selectProgressionCandidate(candidateSet(options).candidates, "familiar")?.chords).toEqual(options[0]);
  });
  it.each([{ done: false }, { done_reason: "length" }, { message: { content: "{}" } }, { eval_count: -1 }])("rejects incomplete/invalid envelope %j", async (extra) => {
    network.mockResolvedValue(Response.json(envelope(undefined, extra)));
    await expect(generateLocalProgression(ids)).rejects.toMatchObject({ code: "invalid_output" });
  });
  it("rejects non-JSON provider bodies", async () => {
    network.mockResolvedValue(new Response("not json"));
    await expect(generateLocalProgression(ids)).rejects.toMatchObject({ code: "invalid_output" });
  });
  it.each([302, 404, 500])("maps provider HTTP %s to unavailable without retry", async (status) => {
    network.mockResolvedValue(new Response("sensitive", { status }));
    await expect(generateLocalProgression(ids)).rejects.toMatchObject({ code: "unavailable" });
    expect(network).toHaveBeenCalledTimes(1);
  });
  it("maps transport failures to unavailable", async () => {
    network.mockRejectedValue(new Error("secret transport details"));
    await expect(generateLocalProgression(ids)).rejects.toMatchObject({ code: "unavailable" });
  });
  it("bounds bytes without Content-Length and cancels overflow", async () => {
    const cancel = vi.fn();
    network.mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65537)); }, cancel })));
    await expect(generateLocalProgression(ids)).rejects.toMatchObject({ code: "invalid_output" });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("rejects oversized Content-Length and cancels the body", async () => {
    const cancel = vi.fn();
    network.mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: { "content-length": "65537" } }));
    await expect(generateLocalProgression(ids)).rejects.toMatchObject({ code: "invalid_output" });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it.each(["headers", "body"])("keeps the 30-second deadline through %s", async (phase) => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    network.mockImplementation(() => phase === "headers" ? new Promise(() => {}) : Promise.resolve(new Response(new ReadableStream({ cancel }))));
    const result = generateLocalProgression(ids);
    const assertion = expect(result).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    if (phase === "body") expect(cancel).toHaveBeenCalledOnce();
    expect(network.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
  it("handles an already aborted caller without inference", async () => {
    await expect(generateLocalProgression(ids, { signal: AbortSignal.abort() })).rejects.toMatchObject({ code: "timeout" });
    expect(network).not.toHaveBeenCalled();
  });
  it("cancels response consumption on caller abort", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    network.mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const result = generateLocalProgression(ids, { signal: controller.signal });
    const assertion = expect(result).rejects.toMatchObject({ code: "timeout" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await assertion;
    expect(cancel).toHaveBeenCalledOnce();
  });
});
