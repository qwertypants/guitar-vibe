import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareModel } from "../scripts/check-model.mjs";

const config = { baseUrl: "http://127.0.0.1:11434", model: "qwen2.5:1.5b", readyMs: 20, pollMs: 1, pullMs: 20 };

async function withFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { await run(); } finally { globalThis.fetch = original; }
}

test("installed model requires no download", async () => {
  const paths = [];
  await withFetch(async (url) => { paths.push(url.pathname); return new Response("{}"); }, async () => {
    assert.equal(await prepareModel(config), "already installed");
    assert.deepEqual(paths, ["/api/tags", "/api/show"]);
  });
});

test("missing model pulls once and verifies installation", async () => {
  const paths = [];
  await withFetch(async (url, options) => {
    paths.push(url.pathname);
    if (paths.length === 2) return new Response("{}", { status: 404 });
    if (url.pathname === "/api/pull") {
      assert.deepEqual(JSON.parse(options.body), { name: config.model, stream: false });
      return Response.json({ status: "success" });
    }
    return new Response("{}");
  }, async () => {
    assert.equal(await prepareModel(config), "downloaded");
    assert.deepEqual(paths, ["/api/tags", "/api/show", "/api/pull", "/api/show"]);
  });
});

test("inspection failure does not download", async () => {
  await withFetch(async (url) => new Response("{}", { status: url.pathname === "/api/show" ? 500 : 200 }), async () => {
    await assert.rejects(prepareModel(config), /inspection failed/);
  });
});

test("unavailable server fails within readiness deadline", async () => {
  await withFetch(async () => { throw new Error("offline"); }, async () => {
    await assert.rejects(prepareModel(config), /setup deadline/);
  });
});

test("failed pull and unconfirmed pull fail setup", async () => {
  for (const result of [{ error: "missing" }, { status: "incomplete" }]) {
    await withFetch(async (url) => {
      if (url.pathname === "/api/show") return new Response("{}", { status: 404 });
      return Response.json(url.pathname === "/api/pull" ? result : {});
    }, async () => { await assert.rejects(prepareModel(config), /successful download/); });
  }
});

test("setup rejects remote endpoints and cloud model tags before fetch", async () => {
  for (const options of [{ baseUrl: "https://example.com" }, { baseUrl: "http://user:secret@localhost:11434" }, { model: "qwen:cloud" }]) {
    await assert.rejects(prepareModel({ ...config, ...options }), /local/);
  }
});

test("stalled download is aborted by the configured deadline", async () => {
  await withFetch(async (url, options) => {
    if (url.pathname === "/api/show") return new Response("{}", { status: 404 });
    if (url.pathname !== "/api/pull") return Response.json({});
    return new Promise((_, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      // Keep the mock request active until the timeout fires, as real I/O would.
      const timer = setTimeout(() => reject(new Error("test download did not abort")), 200);
      options.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
    });
  }, async () => {
    await assert.rejects(prepareModel(config), (error) => error.name === "TimeoutError");
  });
});
