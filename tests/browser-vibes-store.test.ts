import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { BROWSER_VIBES_KEY, createBrowserVibesStore } from "@/lib/browser-vibes-store";

const snapshot = { vibeIds: ["mood-dreamy"], chords: ["C", "F", "G"] };
beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

test("saves, reloads newest first, deletes, and never reuses an identifier", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
  const store = createBrowserVibesStore();
  expect(store.list()).toEqual([]);
  const first = store.save(snapshot);
  const second = store.save(snapshot);
  expect(createBrowserVibesStore().list()).toEqual([second, first]);
  store.delete(second.id);
  expect(store.list()).toEqual([first]);
  const third = store.save(snapshot);
  expect(third.id).toBe(3);
  expect(third.createdAt).toBe("2026-10-27T12:00:00.000Z");
  expect(() => store.delete(99)).toThrow("not found");
  expect(store.list()).toEqual([third, first]);
});

test.each([
  "not json", JSON.stringify({ vibes: [] }),
  JSON.stringify({ nextId: 2, vibes: [{ id: 1, createdAt: "yesterday", ...snapshot }] }),
  JSON.stringify({ nextId: 1, vibes: [{ id: 1, createdAt: "2026-10-27T12:00:00Z", ...snapshot }] }),
  JSON.stringify({ nextId: 2, vibes: [{ id: 1, createdAt: "2026-10-27T12:00:00Z", ...snapshot, vibeIds: ["unknown"] }] }),
  JSON.stringify({ nextId: 2, vibes: [1, 1].map((id) => ({ id, createdAt: "2026-10-27T12:00:00Z", ...snapshot })) }),
])("rejects corrupt storage without overwriting it: %s", (raw) => {
  localStorage.setItem(BROWSER_VIBES_KEY, raw);
  const store = createBrowserVibesStore();
  expect(() => store.list()).toThrow();
  expect(() => store.save(snapshot)).toThrow();
  expect(() => store.delete(1)).toThrow();
  expect(localStorage.getItem(BROWSER_VIBES_KEY)).toBe(raw);
});

test.each([
  { ...snapshot, vibeIds: ["unknown"] },
  { ...snapshot, vibeIds: ["mood-dreamy", "mood-moody"] },
  { ...snapshot, chords: ["C", "C", "C"] },
  { ...snapshot, chords: ["C", "unsupported", "G"] },
  { ...snapshot, extra: true },
])("rejects invalid snapshots without writing: %j", (input) => {
  expect(() => createBrowserVibesStore().save(input)).toThrow("invalid");
  expect(localStorage.getItem(BROWSER_VIBES_KEY)).toBeNull();
});

test("reports blocked storage and quota errors without pretending to save", () => {
  const blocked = createBrowserVibesStore(() => { throw new Error("Storage blocked"); });
  expect(() => blocked.list()).toThrow("blocked");
  const setItem = vi.fn(() => { throw new Error("Quota exceeded"); });
  const full = createBrowserVibesStore(() => ({ getItem: () => null, setItem }));
  expect(() => full.save(snapshot)).toThrow("Quota exceeded");
  localStorage.setItem(BROWSER_VIBES_KEY, JSON.stringify({ nextId: Number.MAX_SAFE_INTEGER, vibes: [] }));
  expect(() => createBrowserVibesStore().save(snapshot)).toThrow("limit");
});
