import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { vibeCatalog } from "@/lib/vibes";
import { progressionSchema, resolveProgression } from "@/lib/progression";

export type SavedVibe = { id: number; createdAt: string; vibeIds: string[]; chords: string[] };
const snapshotSchema = z.object({
  vibeIds: z.array(z.string().min(1).max(64)).min(1).max(5),
  chords: progressionSchema.shape.chords,
}).strict();

function parseSnapshot(value: unknown): { vibeIds: string[]; chords: string[] } | null {
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success || parsed.data.vibeIds.length < 1 || parsed.data.vibeIds.length > 5) return null;
  const ids = new Set<string>();
  const facets = new Set<string>();
  for (const id of parsed.data.vibeIds) {
    const option = vibeCatalog.find((item) => item.id === id);
    if (!option || ids.has(id) || facets.has(option.facet)) return null;
    ids.add(id); facets.add(option.facet);
  }
  if (!resolveProgression(parsed.data.chords) || new Set(parsed.data.chords).size < 2) return null;
  return parsed.data;
}

export function createVibesStore(filePath: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS vibes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    vibe_ids TEXT NOT NULL,
    chords TEXT NOT NULL
  )`);
  const listQuery = db.prepare("SELECT id, created_at AS createdAt, vibe_ids AS vibeIds, chords FROM vibes ORDER BY created_at DESC, id DESC");
  const insertQuery = db.prepare("INSERT INTO vibes (created_at, vibe_ids, chords) VALUES (?, ?, ?)");
  const deleteQuery = db.prepare("DELETE FROM vibes WHERE id = ?");
  return {
    list(): SavedVibe[] {
      return (listQuery.all() as { id: number; createdAt: string; vibeIds: string; chords: string }[]).map((row) => ({
        id: row.id, createdAt: row.createdAt, vibeIds: JSON.parse(row.vibeIds) as string[], chords: JSON.parse(row.chords) as string[],
      }));
    },
    save(snapshot: unknown): SavedVibe | null {
      const parsed = parseSnapshot(snapshot);
      if (!parsed) return null;
      const createdAt = new Date().toISOString();
      const result = insertQuery.run(createdAt, JSON.stringify(parsed.vibeIds), JSON.stringify(parsed.chords));
      return { id: Number(result.lastInsertRowid), createdAt, ...parsed };
    },
    delete(id: number): boolean { return deleteQuery.run(id).changes > 0; },
    close(): void { db.close(); },
  };
}

const dbPath = path.resolve(process.env.VIBES_DB_PATH ?? path.join(process.cwd(), "data", "vibes.sqlite"));
const store = createVibesStore(dbPath);
export const listVibes = store.list;
export const saveVibe = store.save;
export const deleteVibe = store.delete;
