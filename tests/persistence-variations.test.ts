// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createVibesStore } from "@/lib/server/vibes-store";
import { BROWSER_VIBES_KEY, createBrowserVibesStore } from "@/lib/browser-vibes-store";
import { parseSnapshot, savedVibeSchema, snapshotSchema } from "@/lib/saved-vibe";

const legacy = { vibeIds: ["mood-dreamy"], chords: ["C", "F", "G"] };
const progressions = {
  original: { id: "original", label: "Original", chords: ["C", "F", "G"] },
  variations: [
    { id: "variation-1", label: "Variation 1 · Dreamy", direction: { kind: "mood", moodId: "mood-dreamy" }, chords: ["Am", "F", "C"] },
    { id: "variation-2", label: "Variation 2 · Surprise", direction: { kind: "surprise" }, chords: ["Dm", "G", "C"] },
  ],
};
const snapshot = { ...legacy, progressions };
const folders: string[] = [];
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });
const dbFile = () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), "vibes-variations-"));
  folders.push(folder);
  return path.join(folder, "vibes.sqlite");
};
const memoryStorage = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
};

test("schemas normalize legacy records and preserve complete ordered collections", () => {
  expect(snapshotSchema.parse(legacy).progressions).toEqual({ original: progressions.original, variations: [] });
  expect(savedVibeSchema.parse({ ...legacy, id: 1, createdAt: "2026-10-28T12:00:00Z" }).progressions.variations).toEqual([]);
  expect(parseSnapshot(snapshot)?.progressions).toEqual(progressions);
  expect(parseSnapshot({ ...snapshot, chords: ["Am", "F", "C"] })).toBeNull();
  expect(parseSnapshot({ ...snapshot, progressions: { ...progressions, variations: [...progressions.variations].reverse() } })).toBeNull();
  expect(parseSnapshot({ ...snapshot, progressions: { ...progressions, variations: [{ ...progressions.variations[0], chords: ["C", "unknown", "G"] }] } })).toBeNull();
});

test("browser and SQLite stores round-trip the identical collection after reopening", () => {
  const file = dbFile();
  const storage = memoryStorage();
  const server = createVibesStore(file);
  const browser = createBrowserVibesStore(() => storage);
  expect(server.save(snapshot)?.progressions).toEqual(progressions);
  expect(browser.save(snapshot).progressions).toEqual(progressions);
  server.close();
  const reopened = createVibesStore(file);
  expect(reopened.list()[0]?.progressions).toEqual(progressions);
  expect(createBrowserVibesStore(() => storage).list()[0]?.progressions).toEqual(progressions);
  expect(reopened.list()[0]?.chords).toEqual(legacy.chords);
  reopened.close();
});

test("migrates the existing SQLite table without losing legacy records and can reopen it", () => {
  const file = dbFile();
  const database = new Database(file);
  database.exec("CREATE TABLE vibes (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, vibe_ids TEXT NOT NULL, chords TEXT NOT NULL)");
  database.prepare("INSERT INTO vibes (created_at, vibe_ids, chords) VALUES (?, ?, ?)").run("2026-10-27T12:00:00Z", JSON.stringify(legacy.vibeIds), JSON.stringify(legacy.chords));
  database.close();
  const store = createVibesStore(file);
  expect(store.list()).toEqual([{ ...legacy, id: 1, createdAt: "2026-10-27T12:00:00Z", progressions: { original: progressions.original, variations: [] } }]);
  expect(store.save(snapshot)?.id).toBe(2);
  store.close();
  const reopened = createVibesStore(file);
  expect(reopened.list().map((entry) => entry.progressions.variations.length)).toEqual([2, 0]);
  reopened.close();
});

test("reads old browser data and retains its normalized original when saving new records", () => {
  const storage = memoryStorage();
  storage.setItem(BROWSER_VIBES_KEY, JSON.stringify({ nextId: 2, vibes: [{ ...legacy, id: 1, createdAt: "2026-10-27T12:00:00Z" }] }));
  const store = createBrowserVibesStore(() => storage);
  expect(store.list()[0]?.progressions).toEqual({ original: progressions.original, variations: [] });
  store.save(snapshot);
  expect(createBrowserVibesStore(() => storage).list().map((entry) => entry.progressions.variations.length)).toEqual([2, 0]);
});
