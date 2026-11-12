import type { RenderKind } from "./renderers";

/**
 * Fragment (display-syntax) parser for `![[file#fragment]]` embeds.
 *
 * Grammar by renderer kind — case-insensitive, `~` canonical for ranges
 * (`-` accepted), fragments must precede the `|alias` (Obsidian grammar):
 *   pptx / docx : `page=N` / `N` (single page, N ≡ N~N), `page=N~M` / `N~M`
 *                 (range; open end `page=3~` means "to the last page"),
 *   sheet       : `SheetName`, `A1:D10`, `5:20` (rows), `SheetName!A1:D10`,
 *                 `SheetName!5:20` — split at the LAST `!` so names may
 *                 contain spaces/unicode,
 *   html        : any text = element id to scroll into view.
 *
 * Anything unparsed → null → callers render the whole file (silent fallback).
 */

/** Inclusive 1-based page range; `end` may be POSITIVE_INFINITY ("3~"). */
export interface PageRange {
  start: number;
  end: number;
}

/** Inclusive 1-based cell range; `ec === 0` means "to the last column" (row form `5:20`). */
export interface CellRange {
  sc: number;
  sr: number;
  ec: number;
  er: number;
}

export type ParsedFragment =
  | { type: "pages"; start: number; end: number; raw: string }
  | { type: "sheet"; name: string; raw: string }
  | { type: "sheetRange"; sheet?: string; range: CellRange; isRowForm: boolean; raw: string }
  | { type: "element"; id: string; raw: string };

export const OPEN_END = Number.POSITIVE_INFINITY;

// (\d*) — NOT (\d+)? — so an open end ("page=3~") captures "" while a plain
// "page=3" leaves the group undefined: that distinction is the whole grammar.
const PAGE_WITH_PREFIX = /^page=(\d+)(?:[~-](\d*))?$/i;
const PAGE_BARE = /^(\d+)(?:[~-](\d*))?$/;
const CELL_RANGE = /^([A-Za-z]{1,3})(\d+):([A-Za-z]{1,3})(\d+)$/;
const ROW_RANGE = /^(\d+):(\d+)$/;

export function colToLetter(n: number): string {
  let s = "";
  let v = n;
  while (v > 0) {
    const rem = (v - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    v = Math.floor((v - 1) / 26);
  }
  return s;
}

function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** Human-readable normalized form ("A1:D10"), for badges. */
export function formatCellRange(range: CellRange): string {
  const from = `${colToLetter(range.sc)}${range.sr}`;
  const to = range.ec > 0 ? `${colToLetter(range.ec)}${range.er}` : `${range.er}`;
  return `${from}:${to}`;
}

function parsePageForm(m: RegExpExecArray): { start: number; end: number } | null {
  const start = parseInt(m[1], 10);
  if (!Number.isFinite(start) || start < 1) return null;
  let end: number;
  if (m[2] === undefined) {
    end = start; // "page=3" ≡ "3~3"
  } else if (m[2] === "") {
    end = OPEN_END; // "page=3~" → to the last page
  } else {
    end = parseInt(m[2], 10);
    if (!Number.isFinite(end) || end < 1) return null;
  }
  // "8~3" is a typo for "3~8" — normalize instead of failing.
  if (end !== OPEN_END && start > end) {
    return { start: end, end: start };
  }
  return { start, end };
}

function parseCellRangeForm(text: string): CellRange | null {
  const m = CELL_RANGE.exec(text.trim());
  if (!m) return null;
  let sc = colToIndex(m[1]);
  let sr = parseInt(m[2], 10);
  let ec = colToIndex(m[3]);
  let er = parseInt(m[4], 10);
  if (!sc || !ec || !sr || !er) return null;
  if (sc > ec) [sc, ec] = [ec, sc];
  if (sr > er) [sr, er] = [er, sr];
  return { sc, sr, ec, er };
}

function parseRowRangeForm(text: string): CellRange | null {
  const m = ROW_RANGE.exec(text.trim());
  if (!m) return null;
  let sr = parseInt(m[1], 10);
  let er = parseInt(m[2], 10);
  if (!sr || !er) return null;
  if (sr > er) [sr, er] = [er, sr];
  return { sc: 1, sr, ec: 0, er };
}

/** Parse `fragmentRaw` for `kind`; returns null when it matches no form. */
export function parseFragment(raw: string, kind: RenderKind): ParsedFragment | null {
  const text = raw.trim();
  if (!text) return null;

  if (kind === "pptx" || kind === "docx") {
    const m = PAGE_WITH_PREFIX.exec(text) ?? PAGE_BARE.exec(text);
    if (m) {
      const pages = parsePageForm(m);
      if (pages) return { type: "pages", ...pages, raw: text };
    }
    return null;
  }

  if (kind === "sheet") {
    // "Sheet 2!A1:D10" — the range part never contains "!", so split at the
    // LAST "!" and fall through to sheet-name when the right side isn't one.
    const bang = text.lastIndexOf("!");
    if (bang > 0) {
      const left = text.slice(0, bang).trim();
      const right = text.slice(bang + 1).trim();
      const range = parseCellRangeForm(right) ?? parseRowRangeForm(right);
      if (range && left) {
        return { type: "sheetRange", sheet: left, range, isRowForm: ROW_RANGE.test(right), raw: text };
      }
    }
    const range = parseCellRangeForm(text) ?? parseRowRangeForm(text);
    if (range) {
      return { type: "sheetRange", range, isRowForm: ROW_RANGE.test(text), raw: text };
    }
    return { type: "sheet", name: text, raw: text };
  }

  if (kind === "html") {
    return { type: "element", id: text, raw: text };
  }

  return null; // "card" and unparsed fragments
}
