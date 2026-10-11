import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

export async function prepareModel({ baseUrl, model, readyMs = 60_000, pullMs = 900_000, pollMs = 1000 }) {
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]", "host.docker.internal", "ollama"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Use a local HTTP Ollama endpoint without credentials or a path.");
  }
  if (!model || !/^[a-zA-Z0-9._:-]+$/.test(model) || /cloud/i.test(model)) throw new Error("Use an explicit local model tag.");
  const deadline = Date.now() + readyMs;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL("/api/tags", url), { signal: AbortSignal.timeout(Math.max(1, Math.min(3000, deadline - Date.now()))) });
      if (response.ok) { ready = true; break; }
    } catch { /* Retry readiness within the total deadline. */ }
    await delay(Math.min(pollMs, Math.max(0, deadline - Date.now())));
  }
  if (!ready) throw new Error("Ollama did not become ready within the setup deadline.");
  const show = () => fetch(new URL("/api/show", url), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: model }), signal: AbortSignal.timeout(5000) });
  const existing = await show();
  if (existing.ok) return "already installed";
  if (existing.status !== 404) throw new Error("Ollama model inspection failed.");
  console.log(`Downloading ${model}; initial setup can require internet access.`);
  const pulled = await fetch(new URL("/api/pull", url), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: model, stream: false }), signal: AbortSignal.timeout(pullMs) });
  if (!pulled.ok) throw new Error("Model download failed.");
  const result = await pulled.json();
  if (result.error || result.status !== "success") throw new Error("Ollama did not confirm a successful download.");
  if (!(await show()).ok) throw new Error("Downloaded model is not available.");
  return "downloaded";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  prepareModel({ baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434", model: process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b" })
    .then((status) => console.log(`Model ready (${status}).`))
    .catch((error) => { console.error(`Model setup failed: ${error.message}`); process.exitCode = 1; });
}
