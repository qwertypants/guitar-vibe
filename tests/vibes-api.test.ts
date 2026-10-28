// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

let folder: string;
let GET: typeof import("@/app/api/vibes/route").GET;
let POST: typeof import("@/app/api/vibes/route").POST;
let DELETE: typeof import("@/app/api/vibes/[id]/route").DELETE;
beforeAll(async () => {
  folder = mkdtempSync(path.join(os.tmpdir(), "vibes-api-"));
  vi.stubEnv("VIBES_DB_PATH", path.join(folder, "vibes.sqlite"));
  vi.resetModules();
  ({ GET, POST } = await import("@/app/api/vibes/route"));
  ({ DELETE } = await import("@/app/api/vibes/[id]/route"));
});
afterAll(() => { vi.unstubAllEnvs(); rmSync(folder, { recursive: true, force: true }); });

it("saves, reloads, rejects invalid payloads, and deletes a saved vibe", async () => {
  expect((await POST(new Request("http://localhost/api/vibes", { method: "POST", body: "{" }))).status).toBe(400);
  expect((await POST(new Request("http://localhost/api/vibes", { method: "POST", body: JSON.stringify({}) }))).status).toBe(400);
  const invalid = await POST(new Request("http://localhost/api/vibes", { method: "POST", body: JSON.stringify({ vibeIds: ["bogus"], chords: ["Am", "F", "C"] }) }));
  expect(invalid.status).toBe(400);
  const extraField = await POST(new Request("http://localhost/api/vibes", { method: "POST", body: JSON.stringify({ vibeIds: ["mood-dreamy"], chords: ["Am", "F", "C"], note: "ignored input" }) }));
  expect(extraField.status).toBe(400);
  const saved = await POST(new Request("http://localhost/api/vibes", { method: "POST", body: JSON.stringify({ vibeIds: ["mood-dreamy", "genre-jazz"], chords: ["Am", "F", "C"] }) }));
  expect(saved.status).toBe(201);
  const body = await saved.json() as { vibe: { id: number; vibeIds: string[]; chords: string[] } };
  expect(body.vibe).toMatchObject({ vibeIds: ["mood-dreamy", "genre-jazz"], chords: ["Am", "F", "C"] });
  expect((await GET().json() as { vibes: unknown[] }).vibes).toHaveLength(1);
  expect((await DELETE(new Request("http://localhost/api/vibes/invalid", { method: "DELETE" }), { params: Promise.resolve({ id: "0" }) })).status).toBe(400);
  expect((await DELETE(new Request(`http://localhost/api/vibes/${body.vibe.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: String(body.vibe.id) }) })).status).toBe(204);
  expect((await DELETE(new Request("http://localhost/api/vibes/999", { method: "DELETE" }), { params: Promise.resolve({ id: "999" }) })).status).toBe(404);
  expect((await GET().json() as { vibes: unknown[] }).vibes).toEqual([]);
  const progressions = {
    original: { id: "original", label: "Original", chords: ["Am", "F", "C"] },
    variations: [
      { id: "variation-1", label: "Variation 1 · Dreamy", direction: { kind: "mood", moodId: "mood-dreamy" }, chords: ["C", "F", "G"] },
      { id: "variation-2", label: "Variation 2 · Surprise", direction: { kind: "surprise" }, chords: ["Dm", "G", "C"] },
    ],
  };
  const collectionSave = await POST(new Request("http://localhost/api/vibes", { method: "POST", body: JSON.stringify({ vibeIds: ["mood-dreamy"], chords: ["Am", "F", "C"], progressions }) }));
  expect(collectionSave.status).toBe(201);
  expect((await collectionSave.json()).vibe.progressions).toEqual(progressions);
  expect((await GET().json()).vibes[0].progressions).toEqual(progressions);
  const database = new Database(path.join(folder, "vibes.sqlite"));
  database.exec("DROP TABLE vibes");
  database.close();
  expect((await GET()).status).toBe(500);
  expect((await POST(new Request("http://localhost/api/vibes", { method: "POST", body: JSON.stringify({ vibeIds: ["mood-dreamy"], chords: ["Am", "F", "C"] }) }))).status).toBe(500);
  expect((await DELETE(new Request("http://localhost/api/vibes/1", { method: "DELETE" }), { params: Promise.resolve({ id: "1" }) })).status).toBe(500);
});
