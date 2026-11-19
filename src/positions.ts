/**
 * Reading-position memory (v0.6 M0, TAB channel only — never embeds).
 *
 * Adjudication rules (promo/v0.6-tasks.md,验收红线):
 *   embed (frag)     → memory does not participate at all
 *   tab + locate     → locate wins, no restore; scrolling afterwards records
 *   tab, no fragment → memory restores
 * Storage is keyed by file path and only ever written from the tab view.
 */

export interface ReadingPosition {
  /** scrollTop of the kind's scroll surface at last visit. */
  scroll: number;
  /** Active worksheet name (sheet kind only). */
  sheet?: string;
  /** Last-write timestamp — the LRU eviction key. */
  updated: number;
}

export type ReadingPositionMap = Map<string, ReadingPosition>;

/** Keep the persisted map bounded (mirrors Office Reader's 100-file LRU). */
export const READING_POSITION_CAP = 100;

/** Rebuild the map from persisted JSON; junk entries are dropped silently. */
export function sanitizePositions(raw: unknown): ReadingPositionMap {
  const map: ReadingPositionMap = new Map();
  if (!raw || typeof raw !== "object") return map;
  for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!path || !value || typeof value !== "object") continue;
    const v = value as Partial<ReadingPosition>;
    if (typeof v.scroll !== "number" || !Number.isFinite(v.scroll) || v.scroll < 0) continue;
    map.set(path, {
      scroll: v.scroll,
      sheet: typeof v.sheet === "string" && v.sheet ? v.sheet : undefined,
      updated: typeof v.updated === "number" && Number.isFinite(v.updated) ? v.updated : 0,
    });
  }
  return map;
}

/** Upsert a position and evict the least-recently-updated entry over the cap. */
export function notePosition(map: ReadingPositionMap, path: string, pos: { scroll: number; sheet?: string }): void {
  map.set(path, {
    scroll: pos.scroll,
    sheet: pos.sheet ?? map.get(path)?.sheet,
    updated: Date.now(),
  });
  if (map.size <= READING_POSITION_CAP) return;
  let oldestPath: string | null = null;
  let oldest = Infinity;
  for (const [key, value] of map) {
    if (value.updated < oldest) {
      oldest = value.updated;
      oldestPath = key;
    }
  }
  // The entry just written carries `Date.now()` and can never be the oldest,
  // so this always evicts somebody else.
  if (oldestPath) map.delete(oldestPath);
}
