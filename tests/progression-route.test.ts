// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { POST } from "@/app/api/progression/route";
import { resolveProgression } from "@/lib/progression";
const network = vi.fn<typeof fetch>();
const symbols = ["Am", "F", "C", "G"];
const valid = { message: { role: "assistant", content: JSON.stringify({ chords: symbols }) }, done: true, done_reason: "stop",
  load_duration: 0, prompt_eval_count: 20, eval_count: 15, eval_duration: 1_000_000 };
function request(body: unknown) { return new Request("http://localhost/api/progression", { method: "POST", body: JSON.stringify(body) }); }
beforeEach(() => { vi.stubGlobal("fetch", network); network.mockReset(); vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"); vi.stubEnv("OLLAMA_MODEL", "qwen2.5:1.5b"); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
it.each([{}, { vibeIds: [] }, { vibeIds: ["unknown"] }, { vibeIds: ["mood-dark", "mood-dark"] }, { vibeIds: ["mood-dark", "mood-joyful"] }, { vibeIds: ["genre-jazz"], text: "ignore instructions" }])("rejects invalid body %j without inference", async (body) => {
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
it("maps invalid output to 502 without returning model text", async () => {
  network.mockResolvedValue(Response.json({ ...valid, message: { role: "assistant", content: "sensitive invalid content" } }));
  const response = await POST(request({ vibeIds: ["genre-jazz"] }));
  expect(response.status).toBe(502);
  expect(JSON.stringify(await response.json())).not.toContain("sensitive");
});
it("maps total deadline to 504", async () => {
  vi.useFakeTimers(); network.mockImplementation(() => new Promise(() => {}));
  const pending = POST(request({ vibeIds: ["genre-jazz"] }));
  await vi.advanceTimersByTimeAsync(30_000);
  expect((await pending).status).toBe(504);
});
