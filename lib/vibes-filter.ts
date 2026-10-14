import type { SavedVibe } from "@/lib/server/vibes-store";

export function filterVibes(entries: readonly SavedVibe[], selectedIds: readonly string[]): readonly SavedVibe[] {
  if (selectedIds.length === 0) return entries;
  const selected = new Set(selectedIds);
  return entries.filter((entry) => entry.vibeIds.some((id) => selected.has(id)));
}
