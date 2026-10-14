// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createVibesStore } from "@/lib/server/vibes-store";
import { filterVibes } from "@/lib/vibes-filter";

const folders: string[] = [];
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });
function tempStore() {
  const folder = mkdtempSync(path.join(os.tmpdir(), "vibes-store-"));
  folders.push(folder);
  return createVibesStore(path.join(folder, "nested", "vibes.sqlite"));
}

it("initializes a database path, saves snapshots newest first, and deletes by id", () => {
  const store = tempStore();
  const first = store.save({ vibeIds: ["mood-dreamy", "genre-jazz"], chords: ["Am", "F", "C"] });
  const second = store.save({ vibeIds: ["setting-rainy-night"], chords: ["C", "G", "Am"] });
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(store.list().map(({ id }) => id)).toEqual([second?.id, first?.id]);
  expect(store.list()[1]).toMatchObject({ vibeIds: ["mood-dreamy", "genre-jazz"], chords: ["Am", "F", "C"] });
  expect(store.delete(first!.id)).toBe(true);
  expect(store.delete(first!.id)).toBe(false);
  expect(store.list()).toHaveLength(1);
  store.close();
});

it.each([
  {}, { vibeIds: [], chords: ["Am", "F", "C"] }, { vibeIds: ["unknown"], chords: ["Am", "F", "C"] },
  { vibeIds: ["mood-dark", "mood-warm"], chords: ["Am", "F", "C"] },
  { vibeIds: ["mood-dark"], chords: ["Am", "nonsense", "C"] },
  { vibeIds: ["mood-dark"], chords: ["Am", "Am", "Am"] },
])("rejects invalid saved snapshots: %j", (payload) => {
  const store = tempStore();
  expect(store.save(payload)).toBeNull();
  expect(store.list()).toEqual([]);
  store.close();
});

it("filters saved vibes by any selected facet value and restores all on clear", () => {
  const entries = [
    { id: 1, createdAt: "", vibeIds: ["mood-dreamy", "genre-jazz"], chords: ["Am", "F", "C"] },
    { id: 2, createdAt: "", vibeIds: ["setting-rainy-night"], chords: ["C", "G", "Am"] },
  ];
  expect(filterVibes(entries, ["genre-jazz", "setting-rainy-night"]).map(({ id }) => id)).toEqual([1, 2]);
  expect(filterVibes(entries, []).map(({ id }) => id)).toEqual([1, 2]);
});
