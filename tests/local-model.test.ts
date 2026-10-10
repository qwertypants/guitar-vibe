// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { generateLocalProgression, LocalModelError } from "@/lib/server/local-model";
import { SUPPORTED_CHORDS } from "@/lib/chords";

const ids = ["mood-melancholy", "genre-jazz"];
const chords = ["Am7", "Dm7", "G7", "Cmaj7"];
function envelope(content = JSON.stringify({ chords }), extra = {}) {
  return { message: { role: "assistant", content }, done: true, done_reason: "stop", load_duration: 2_000_000,
    prompt_eval_count: 100, eval_count: 20, eval_duration: 10_000_000, ...extra };
}
const network = vi.fn<typeof fetch>();
beforeEach(() => { vi.stubGlobal("fetch", network); network.mockReset(); vi.stubEnv("OLLAMA_MODEL", "qwen2.5:1.5b"); vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("local generation", () => {
  it("uses one constrained request and returns validated chords and metrics", async () => {
    network.mockResolvedValue(Response.json(envelope()));
    const result = await generateLocalProgression(ids, { seed: 42 });
    expect(result.chords).toEqual(chords);
    expect(result.metrics).toEqual({ wallMs: expect.any(Number), loadMs: 2, promptTokens: 100, outputTokens: 20, generationMs: 10 });
    expect(network).toHaveBeenCalledTimes(1);
    const [url, init] = network.mock.calls[0]!;
    expect(String(url)).toBe("http://127.0.0.1:11434/api/chat");
    expect(init).toMatchObject({ method: "POST", redirect: "error", signal: expect.any(AbortSignal) });
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: "qwen2.5:1.5b", stream: false, think: false, keep_alive: "5m",
      options: { temperature: 0.2, num_ctx: 2048, num_predict: 128, seed: 42 } });
    expect(body.format.properties.chords.items.enum).toEqual(SUPPORTED_CHORDS.map(({ symbol }) => symbol));
    expect(body.messages.map((message: { content: string }) => message.content).join(" ")).toContain("Melancholy");
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
  it.each(["not json", "```json\n{}\n```", JSON.stringify({ chords: "Am" }), JSON.stringify({ chords: ["Am", "C"] }),
    JSON.stringify({ chords: Array(9).fill("Am") }), JSON.stringify({ chords: ["Am", "C", "G13"] }),
    JSON.stringify({ chords: ["Am", "Am", "Am"] }), JSON.stringify({ chords: [" Am", "C", "G"] }),
    JSON.stringify({ chords, voicings: [] })])("rejects malformed or invalid model content %s", async (content) => {
    network.mockResolvedValue(Response.json(envelope(content)));
    const result = generateLocalProgression(ids);
    await expect(result).rejects.toBeInstanceOf(LocalModelError);
    await expect(result).rejects.toMatchObject({ code: "invalid_output" });
    expect(network).toHaveBeenCalledOnce();
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
