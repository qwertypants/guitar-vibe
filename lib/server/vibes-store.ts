import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { parseSnapshot, savedVibeSchema, type SavedVibe } from "@/lib/saved-vibe";
export type { SavedVibe } from "@/lib/saved-vibe";

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
  const columns = db.pragma("table_info(vibes)") as { name: string }[];
  if (!columns.some(({ name }) => name === "progressions")) db.exec("ALTER TABLE vibes ADD COLUMN progressions TEXT");
  const listQuery = db.prepare("SELECT id, created_at AS createdAt, vibe_ids AS vibeIds, chords, progressions FROM vibes ORDER BY created_at DESC, id DESC");
  const insertQuery = db.prepare("INSERT INTO vibes (created_at, vibe_ids, chords, progressions) VALUES (?, ?, ?, ?)");
  const deleteQuery = db.prepare("DELETE FROM vibes WHERE id = ?");
  return {
    list(): SavedVibe[] {
      return (listQuery.all() as { id: number; createdAt: string; vibeIds: string; chords: string; progressions: string | null }[]).map((row) => savedVibeSchema.parse({
        id: row.id, createdAt: row.createdAt, vibeIds: JSON.parse(row.vibeIds) as string[], chords: JSON.parse(row.chords),
        ...(row.progressions === null ? {} : { progressions: JSON.parse(row.progressions) }),
      }));
    },
    save(snapshot: unknown): SavedVibe | null {
      const parsed = parseSnapshot(snapshot);
      if (!parsed) return null;
      const createdAt = new Date().toISOString();
      const result = insertQuery.run(createdAt, JSON.stringify(parsed.vibeIds), JSON.stringify(parsed.chords), JSON.stringify(parsed.progressions));
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
