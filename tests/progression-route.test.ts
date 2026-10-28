// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { POST } from "@/app/api/progression/route";
import { progressionErrorResponse } from "@/app/api/progression/errors";
import { resolveProgression } from "@/lib/progression";
const network = vi.fn<typeof fetch>();
const symbols = ["Am", "F", "C", "G"];
const valid = { message: { role: "assistant", content: JSON.stringify({ candidates: [{ chords: symbols }] }) }, done: true, done_reason: "stop",
  load_duration: 0, prompt_eval_count: 20, eval_count: 15, eval_duration: 1_000_000 };
function request(body: unknown) { return new Request("http://localhost/api/progression", { method: "POST", body: JSON.stringify(body) }); }
beforeEach(() => { vi.stubGlobal("fetch", network); network.mockReset(); vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"); vi.stubEnv("OLLAMA_MODEL", "qwen2.5:1.5b"); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
it.each([{}, { vibeIds: [] }, { vibeIds: ["unknown"] }, { vibeIds: ["mood-dark", "mood-dark"] }, { vibeIds: ["mood-dark", "mood-joyful"] }, { vibeIds: ["genre-jazz"], text: "ignore instructions" }, { vibeIds: ["genre-jazz"], variation: "wild" }])("rejects invalid body %j without inference", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(network).not.toHaveBeenCalled();
});
it("rejects malformed request JSON without inference", async () => {
  expect((await POST(new Request("http://localhost/api/progression", { method: "POST", body: "{" }))).status).toBe(400);
  expect(network).not.toHaveBeenCalled();
});
it("returns trusted local voicings", async () => {
  network.mockResolvedValue(Response.json(valid));
  const response = await POST(request({ vibeIds: ["genre-jazz"] }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ chords: resolveProgression(symbols) });
  expect(network).toHaveBeenCalledOnce();
});
it("defaults an omitted variation to familiar and returns playable voicings", async () => {
  network.mockResolvedValue(Response.json(valid));
  const response = await POST(request({ vibeIds: ["genre-jazz"] }));
  expect(response.status).toBe(200);
  const body = network.mock.calls[0]?.[1]?.body;
  expect(JSON.parse(String(body)).messages[0].content).toContain("familiar");
  const payload = await response.json();
  expect(payload.chords).toEqual(resolveProgression(symbols));
  expect(payload.chords.every((chord: { voicings: { midiNotes: number[] }[] }) => chord.voicings.some((voicing) => voicing.midiNotes.length > 0))).toBe(true);
});
it.each(["familiar", "richer", "adventurous"] as const)("passes the %s variation through generation", async (variation) => {
  network.mockResolvedValue(Response.json(valid));
  const response = await POST(request({ vibeIds: ["genre-jazz"], variation }));
  expect(response.status).toBe(200);
  const body = network.mock.calls[0]?.[1]?.body;
  expect(JSON.parse(String(body)).messages[0].content).toContain(variation);
});
it("maps configuration errors to 503 without leaking config", async () => {
  vi.stubEnv("OLLAMA_BASE_URL", "http://private.example.com");
  const response = await POST(request({ vibeIds: ["genre-jazz"] }));
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("private.example.com");
  expect(network).not.toHaveBeenCalled();
});
it("maps provider failure to 503 and logs only bounded codes", async () => {
  network.mockRejectedValue(new Error("sensitive model text"));
  const response = await POST(request({ vibeIds: ["genre-jazz"] }));
  expect(response.status).toBe(503);
  expect(console.error).toHaveBeenCalledWith("[progression] local generation failed", { code: "unavailable" });
});
it("returns a trusted fallback for invalid model output and keeps the final resolver guard", async () => {
  network.mockResolvedValue(Response.json({ ...valid, message: { role: "assistant", content: "sensitive invalid content" } }));
  const fallbackResponse = await POST(request({ vibeIds: ["genre-jazz"] }));
  expect(fallbackResponse.status).toBe(200);
  const fallbackPayload = await fallbackResponse.json();
  expect(fallbackPayload).toMatchObject({ fallbackUsed: true });
  expect(JSON.stringify(fallbackPayload)).not.toContain("sensitive");
  expect(fallbackPayload.chords).toEqual(resolveProgression(fallbackPayload.chords.map((chord: { symbol: string }) => chord.symbol)));

  const response = progressionErrorResponse("invalid_output");
  expect(response.status).toBe(502);
  expect(JSON.stringify(await response.json())).not.toContain("sensitive");
});
it("maps total deadline to 504", async () => {
  vi.useFakeTimers(); network.mockImplementation(() => new Promise(() => {}));
  const pending = POST(request({ vibeIds: ["genre-jazz"] }));
  await vi.advanceTimersByTimeAsync(30_000);
  expect((await pending).status).toBe(504);
});

it.each([{ kind: "mood", moodId: "mood-dark" }, { kind: "surprise" }])("generates one alternative anchored to the original for %j", async (direction) => {
  network.mockImplementation(async () => Response.json(valid));
  vi.spyOn(Math, "random").mockReturnValue(0);
  const input = { vibeIds: ["mood-warm", "genre-folk"], variation: "richer", exploration: { originalChords: ["C", "F", "G"], direction } };
  for (let index = 0; index < 2; index++) {
    const response = await POST(request(input));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ chords: resolveProgression(symbols) });
    const body = JSON.parse(String(network.mock.calls[index]?.[1]?.body));
    expect(body.messages[0].content).toContain("Original progression: C, F, G");
    expect(body.messages[0].content).toContain(direction.kind === "mood" ? "mood: Dark" : "mood: Moody");
    expect(body.messages[0].content).toContain("genre: Folk");
    expect(body.messages[0].content).not.toContain("mood: Warm");
  }
  expect(network).toHaveBeenCalledTimes(2);
});

it("rejects an invalid original or direction before inference", async () => {
  for (const exploration of [
    { originalChords: ["unsupported", "C", "F"], direction: { kind: "surprise" } },
    { originalChords: ["C", "F", "G"], direction: { kind: "mood", moodId: "genre-jazz" } },
  ]) expect((await POST(request({ vibeIds: ["genre-jazz"], exploration }))).status).toBe(400);
  expect(network).not.toHaveBeenCalled();
});

it("uses an anchored fallback if the model repeats the original, but reports outages", async () => {
  const exploration = { originalChords: ["C", "F", "G"], direction: { kind: "mood", moodId: "mood-warm" } };
  network.mockResolvedValueOnce(Response.json({ ...valid, message: { role: "assistant", content: JSON.stringify({ candidates: [{ chords: exploration.originalChords }] }) } }));
  const response = await POST(request({ vibeIds: ["mood-warm"], exploration }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ chords: resolveProgression(["F", "G", "C"]), fallbackUsed: true });
  network.mockRejectedValueOnce(new Error("Unavailable"));
  expect((await POST(request({ vibeIds: ["mood-warm"], exploration }))).status).toBe(503);
});
