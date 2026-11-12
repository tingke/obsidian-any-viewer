import * as ExcelJSNS from "exceljs";
import type { Cell, CellValue, Color, Workbook, Worksheet } from "exceljs";
import * as XLSX from "xlsx";
import { TFile } from "obsidian";
import * as JSZipNS from "jszip";
import { Dict } from "./i18n";
import type { CellRange } from "./fragment";

/** Display-syntax options threaded from `![[book.xlsx#Sheet2!A1:D10]]` fragments. */
export interface SheetRenderOpts {
  /** Activate this worksheet (case-insensitive match on its name). */
  activeSheetName?: string;
  /** Render only this region; `ec === 0` = row form `5:20` (all columns). */
  range?: CellRange;
  /** Fragment embeds scope to one region — hide the worksheet tab bar. */
  hideTabBar?: boolean;
}

const ExcelJS: typeof ExcelJSNS = ExcelJSNS;
const JSZip: typeof JSZipNS = JSZipNS;

const MAX_ROWS = 2000;
const MAX_COLS = 80;

/** Theme palette resolved from xl/theme/theme1.xml (index order: lt1,dk1,lt2,dk2,accent1..6). */
type ThemePalette = (string | null)[];

async function loadThemePalette(data: ArrayBuffer): Promise<ThemePalette> {
  const fallback: ThemePalette = ["#FFFFFF", "#000000", "#E7E6E6", "#44546A", "#5B9BD5", "#ED7D31", "#A5A5A5", "#FFC000", "#4472C4", "#70AD47"];
  try {
    const zip = await JSZip.loadAsync(data);
    const themeFile = zip.file(/xl\/theme\/theme\d+\.xml/)?.[0];
    if (!themeFile) return fallback;
    const xml = await themeFile.async("string");
    const scheme = /<a:clrScheme[\s\S]*?<\/a:clrScheme>/.exec(xml)?.[0];
    if (!scheme) return fallback;
    const byName: Record<string, string> = {};
    for (const match of scheme.matchAll(/<a:(dk1|lt1|dk2|lt2|accent[1-6])>([\s\S]*?)<\/a:\1>/g)) {
      const srgb = /<a:srgbClr val="([0-9A-Fa-f]{6})"/.exec(match[2])?.[1];
      const sys = /<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/.exec(match[2])?.[1];
      byName[match[1]] = `#${(srgb ?? sys ?? "000000").toUpperCase()}`;
    }
    // Excel's theme color index order differs from the XML order:
    // 0=lt1, 1=dk1, 2=lt2, 3=dk2, 4..9=accent1..6
    return [byName.lt1, byName.dk1, byName.lt2, byName.dk2, byName.accent1, byName.accent2, byName.accent3, byName.accent4, byName.accent5, byName.accent6];
  } catch (err) {
    console.warn("[Any Viewer] theme palette extraction failed:", err);
    return fallback;
  }
}

/** Apply an OOXML tint to a hex color (positive = lighter, negative = darker). */
function applyTint(hex: string, tint: number): string {
  if (!tint) return hex;
  const n = parseInt(hex.slice(1), 16);
  const out = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = tint > 0 ? v + (255 - v) * tint : v * (1 + tint);
    return Math.round(Math.max(0, Math.min(255, x)));
  });
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Loose shape of an xlsx color as seen at runtime (exceljs types omit tint/indexed). */
type ColorLike = { argb?: string; rgb?: string; theme?: number; tint?: number; indexed?: number };
type BorderSideLike = { style?: string; color?: ColorLike };

/** Resolve any xlsx color shape (argb / theme+tint / indexed) to CSS. */
function resolveColor(color: ColorLike | undefined, palette: ThemePalette): string | null {
  if (!color) return null;
  const raw = typeof color === "string" ? color : color.argb;
  if (typeof raw === "string" && /^[0-9A-Fa-f]{6,8}$/.test(raw)) {
    return `#${(raw.length === 8 ? raw.slice(2) : raw).toUpperCase()}`;
  }
  if (typeof color.theme === "number") {
    const base = palette[color.theme];
    if (base) return applyTint(base, typeof color.tint === "number" ? color.tint : 0);
  }
  return null;
}

export async function renderSheet(container: HTMLElement, file: TFile, data: ArrayBuffer, dict?: Dict, opts?: SheetRenderOpts): Promise<void> {
  const T: Partial<Dict> = dict ?? {};
  const emptyWorkbook = T.emptyWorkbook ?? "(empty workbook)";
  const emptySheet = T.emptySheet ?? "(empty sheet)";
  const ext = (file.extension ?? "").toLowerCase();
  if (ext === "xlsx" || ext === "xlsm") {
    try {
      await renderWithExcelJS(container, data, T, opts);
      return;
    } catch (err) {
      console.warn("[Any Viewer] exceljs render failed, falling back to SheetJS:", err);
      container.empty();
    }
  }
  renderWithSheetJS(container, data, emptyWorkbook, emptySheet, opts);
}

/* ---------------- exceljs (styled) ---------------- */

async function renderWithExcelJS(container: HTMLElement, data: ArrayBuffer, T: Partial<Dict>, opts?: SheetRenderOpts): Promise<void> {
  // Theme colors must be read before exceljs touches the buffer.
  const palette = await loadThemePalette(data);
  const wb: Workbook = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  // Long parses can outlive the embed (timeout / note closed) — anything
  // appended after the stage left the document is garbage, not content.
  if (!container.isConnected) return;
  if (!wb.worksheets.length) {
    container.createDiv({ cls: "any-viewer-empty", text: T.emptyWorkbook ?? "(empty workbook)" });
    return;
  }

  let activeIndex = 0;
  if (opts?.activeSheetName) {
    const wanted = opts.activeSheetName.trim().toLowerCase();
    const found = wb.worksheets.findIndex((ws: Worksheet) => ws.name.trim().toLowerCase() === wanted);
    if (found >= 0) {
      activeIndex = found;
    } else {
      console.warn(`[Any Viewer] sheet "${opts.activeSheetName}" not found — showing the first sheet`);
    }
  }

  // Fragment embeds scope to one region — no tab bar; bare embeds keep it.
  const tabBar = opts?.hideTabBar ? null : container.createDiv({ cls: "any-viewer-sheet-tabs" });
  const content = container.createDiv({ cls: "any-viewer-sheet-content" });

  const show = (ws: Worksheet) => {
    content.empty();
    renderWorksheetExcelJS(content, ws, palette, T, opts?.range);
  };

  const buttons = tabBar
    ? wb.worksheets.map((ws: Worksheet) =>
        tabBar.createEl("button", {
          cls: "any-viewer-tab",
          text: ws.name,
          attr: { type: "button", role: "tab", "aria-selected": "false" },
        })
      )
    : [];
  const activate = (i: number) => {
    buttons.forEach((b, j) => {
      b.classList.toggle("is-active", j === i);
      b.setAttribute("aria-selected", j === i ? "true" : "false");
    });
    show(wb.worksheets[i]);
  };
  buttons.forEach((btn, i) => {
    btn.addEventListener("click", () => activate(i));
  });

  activate(activeIndex);
}

function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** "B3:D5" -> {sc, sr, ec, er} (1-based inclusive) */
function parseRange(ref: string): { sc: number; sr: number; ec: number; er: number } | null {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  return {
    sc: colToIndex(m[1].toUpperCase()),
    sr: parseInt(m[2], 10),
    ec: colToIndex(m[3].toUpperCase()),
    er: parseInt(m[4], 10),
  };
}

/** Resolve a cell color to CSS, honoring the workbook theme palette. */
function cellColor(color: Partial<Color> | undefined, palette: ThemePalette): string | null {
  return resolveColor(color, palette);
}

const BORDER_CSS: Record<string, string> = {
  thin: "1px solid",
  medium: "2px solid",
  thick: "3px solid",
  double: "3px double",
  dashed: "1px dashed",
  dotted: "1px dotted",
  hair: "1px solid",
  mediumDashed: "2px dashed",
  dashDot: "1px dashed",
  mediumDashDot: "2px dashed",
  dashDotDot: "1px dashed",
  mediumDashDotDot: "2px dashed",
  slantDashDot: "2px dashed",
};

function borderCss(side: BorderSideLike | undefined, palette: ThemePalette): string | null {
  if (!side || !side.style) return null;
  const kind = BORDER_CSS[side.style] ?? "1px solid";
  const color = cellColor(side.color, palette) ?? "rgba(140,140,140,.6)";
  return `${kind} ${color}`;
}

function valueText(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatDate(value);
  if (typeof value !== "object") return String(value);
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((fragment) => fragment.text ?? "").join("");
  }
  if ("result" in value) {
    const result = value.result;
    if (result === null || result === undefined) return "";
    if (result instanceof Date) return formatDate(result);
    if (typeof result === "object") return "";
    return String(result);
  }
  if ("text" in value) return String(value.text);
  if ("hyperlink" in value && !("text" in value)) return String(value.hyperlink);
  if ("error" in value) return `#${value.error}`;
  return "";
}

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (d.getHours() || d.getMinutes() || d.getSeconds()) {
    return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  return date;
}

/** Rough numeric/date formatting based on the number format string. */
function formatValue(value: CellValue, numFmt: string | undefined): string {
  const raw = valueText(value);
  if (numFmt && typeof value === "number" && Number.isFinite(value)) {
    try {
      // Quoted literals (currency symbols, units) survive as text around the number.
      const literal = (numFmt.match(/"[^"]*"/g) ?? []).join("").replace(/"/g, "");
      const fmt = numFmt.toLowerCase();
      if (fmt.includes("%")) {
        const numeric = numFmt.replace(/"[^"]*"/g, "");
        const decimals = numeric.includes(".")
          ? (numeric.split(".").pop() ?? "").replace(/[^0#]/g, "").length
          : 0;
        return `${literal}${(value * 100).toFixed(decimals)}%`;
      }
      if (fmt.includes("yy") || fmt.includes("dd") || fmt.includes("mm")) return raw;
      // Strip quoted literals and [color] sections before reading digit placeholders.
      const numeric = numFmt.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
      if (!/[0#]/.test(numeric)) return raw; // "General" or text-only format
      const decimals = numeric.includes(".")
        ? (numeric.split(".").pop() ?? "").replace(/[^0#]/g, "").length
        : 0;
      const body =
        numeric.includes(",") || decimals > 0
          ? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
          : String(Math.round(value));
      // Literal before the digits -> prefix ("¥1,200"); after -> suffix ("1,200元").
      const lastDigit = Math.max(numFmt.lastIndexOf("0"), numFmt.lastIndexOf("#"));
      const literalEnd = numFmt.lastIndexOf('"');
      return literalEnd > lastDigit ? body + literal : literal + body;
    } catch (err) {
      console.warn("[Any Viewer] number formatting failed", err);
      return raw;
    }
  }
  return raw;
}

function cellStyleCss(cell: Cell, palette: ThemePalette): string {
  const style = cell.style ?? {};
  const parts: string[] = [];

  const font = style.font ?? {};
  if (font.bold) parts.push("font-weight:700");
  if (font.italic) parts.push("font-style:italic");
  if (font.underline) parts.push("text-decoration:underline");
  if (font.strike) parts.push("text-decoration:line-through");
  if (font.size) parts.push(`font-size:${Math.min(font.size, 20)}pt`);
  const fontColor = cellColor(font.color, palette);
  if (fontColor) parts.push(`color:${fontColor}`);
  if (font.name) parts.push(`font-family:'${String(font.name).replace(/'/g, "")}',sans-serif`);

  const fill = style.fill;
  if (fill && fill.type === "pattern" && fill.pattern === "solid") {
    const fg = "fgColor" in fill ? cellColor(fill.fgColor, palette) : null;
    const bg = "bgColor" in fill ? cellColor(fill.bgColor, palette) : null;
    const color = fg ?? bg;
    if (color && color.toUpperCase() !== "#FFFFFF") parts.push(`background:${color}`);
  }

  const b = style.border ?? {};
  const top = borderCss(b.top, palette);
  const bottom = borderCss(b.bottom, palette);
  const left = borderCss(b.left, palette);
  const right = borderCss(b.right, palette);
  if (top || bottom || left || right) {
    parts.push(`border:${top ?? "none"}`);
    if (top && bottom) parts.push(`border-bottom:${bottom}`);
    if (left) parts.push(`border-left:${left}`);
    if (right) parts.push(`border-right:${right}`);
  }

  const align = style.alignment ?? {};
  if (align.horizontal) parts.push(`text-align:${align.horizontal}`);
  if (align.vertical) parts.push(`vertical-align:${align.vertical}`);
  if (align.wrapText) parts.push("white-space:pre-wrap");

  return parts.join(";");
}

function cellLink(cell: Cell): string | null {
  const value = cell.value;
  if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
    if ("hyperlink" in value && typeof value.hyperlink === "string" && /^https?:\/\//i.test(value.hyperlink)) {
      return value.hyperlink;
    }
  }
  return null;
}

function renderWorksheetExcelJS(content: HTMLElement, ws: Worksheet, palette: ThemePalette, T: Partial<Dict>, range?: CellRange): void {
  // Effective bounds: a fragment range slices the sheet (inclusive ends,
  // still clamped by MAX_ROWS/MAX_COLS). ec === 0 → row form, all columns.
  const maxRows = Math.min(ws.rowCount ?? 0, MAX_ROWS);
  const maxCols = Math.min(ws.columnCount ?? 0, MAX_COLS);
  const rStart = range ? Math.max(1, range.sr) : 1;
  const rEnd = range ? Math.min(range.er, maxRows) : maxRows;
  const cStart = range ? Math.max(1, range.sc) : 1;
  const cEnd = range && range.ec > 0 ? Math.min(range.ec, maxCols) : maxCols;
  if (range && (rEnd < rStart || cEnd < cStart)) {
    console.warn(`[Any Viewer] range out of bounds on sheet "${ws.name}"`);
    content.createDiv({ cls: "any-viewer-empty", text: T.emptySheet ?? "(empty sheet)" });
    return;
  }

  // Merge ranges live on ws.model.merges (exceljs has no public ws.merges).
  const model = ws.model;
  const mergeRefs: string[] = model?.merges ?? [];

  const masterOf = new Map<string, string>();
  const spanOf = new Map<string, { colspan: number; rowspan: number }>();
  for (const ref of mergeRefs) {
    const m = parseRange(String(ref));
    if (!m) continue;
    // With a range slice, merges are clipped to the intersection; a merge
    // whose master sits outside the slice renders from its first in-range
    // cell with the remaining span — no holes at slice borders.
    const sr = range ? Math.max(m.sr, rStart) : m.sr;
    const er = range ? Math.min(m.er, rEnd) : m.er;
    const sc = range ? Math.max(m.sc, cStart) : m.sc;
    const ec = range && range.ec > 0 ? Math.min(m.ec, cEnd) : m.ec;
    if (sr > er || sc > ec) continue;
    spanOf.set(`${sr},${sc}`, { colspan: ec - sc + 1, rowspan: er - sr + 1 });
    for (let r = sr; r <= er; r++) {
      for (let c = sc; c <= ec; c++) {
        if (r !== sr || c !== sc) masterOf.set(`${r},${c}`, `${sr},${sc}`);
      }
    }
  }

  const rowCount = rEnd;
  const colCount = cEnd;
  if (!rowCount || !colCount) {
    content.createDiv({ cls: "any-viewer-empty", text: T.emptySheet ?? "(empty sheet)" });
    return;
  }

  const table = content.createEl("table", { cls: "any-viewer-sheet-table" });

  const colgroup = table.createEl("colgroup");
  const defaultColWidth = ws.properties?.defaultColWidth ?? 8.43;
  for (let c = cStart; c <= colCount; c++) {
    const width = ws.getColumn(c)?.width;
    // explicit width, else Excel's default column width (~8.43 chars)
    const charWidth = width && width > 0 ? width : defaultColWidth;
    const col = colgroup.createEl("col");
    col.style.width = `${Math.min(Math.round(charWidth * 7 + 5), 400)}px`;
  }

  const defaultRowHeightPt: number | undefined = ws.properties?.defaultRowHeight;
  const rows = new Map<number, HTMLElement>();
  for (let r = rStart; r <= rowCount; r++) {
    const tr = table.createEl("tr");
    const height = ws.getRow(r)?.height;
    if (height && height > 0) tr.style.height = `${Math.round(height * 1.333)}px`;
    else if (defaultRowHeightPt && defaultRowHeightPt > 0) tr.style.minHeight = `${Math.round(defaultRowHeightPt * 1.333)}px`;
    rows.set(r, tr);
  }

  for (let r = rStart; r <= rowCount; r++) {
    const tr = rows.get(r);
    if (!tr) continue;
    const row = ws.getRow(r);
    for (let c = cStart; c <= colCount; c++) {
      if (masterOf.has(`${r},${c}`)) continue; // covered by a merge
      const cell: Cell | undefined = row?.getCell(c);
      const td = tr.createEl("td");
      const span = spanOf.get(`${r},${c}`);
      if (span) {
        if (span.colspan > 1) td.setAttribute("colspan", String(span.colspan));
        if (span.rowspan > 1) td.setAttribute("rowspan", String(span.rowspan));
      }
      if (cell) {
        const css = cellStyleCss(cell, palette);
        if (css) td.setAttribute("style", css);

        const text = formatValue(cell.value, cell.numFmt);
        const href = cellLink(cell);
        if (href) {
          td.createEl("a", { text, href, attr: { target: "_blank", rel: "noopener" } });
        } else {
          td.setText(text);
        }
      }
    }
  }

  if (!range && ((ws.rowCount ?? 0) > MAX_ROWS || (ws.columnCount ?? 0) > MAX_COLS)) {
    const note = T.truncated
      ? T.truncated(MAX_ROWS, MAX_COLS)
      : `Sheet too large — showing first ${MAX_ROWS} rows × ${MAX_COLS} columns (open in a tab to see everything)`;
    content.createDiv({ cls: "any-viewer-sheet-truncated", text: note });
  }
}

/* ---------------- SheetJS (plain) ---------------- */

function renderWithSheetJS(container: HTMLElement, data: ArrayBuffer, emptyWorkbook: string, emptySheet: string, opts?: SheetRenderOpts): void {
  const wb = XLSX.read(new Uint8Array(data), { type: "array" });
  const names = wb.SheetNames;
  if (!names.length) {
    container.createDiv({ cls: "any-viewer-empty", text: emptyWorkbook });
    return;
  }

  let activeIndex = 0;
  if (opts?.activeSheetName) {
    const wanted = opts.activeSheetName.trim().toLowerCase();
    const found = names.findIndex((name) => name.trim().toLowerCase() === wanted);
    if (found >= 0) {
      activeIndex = found;
    } else {
      console.warn(`[Any Viewer] sheet "${opts.activeSheetName}" not found — showing the first sheet`);
    }
  }

  // Fragment embeds scope to one region — no tab bar; bare embeds keep it.
  const tabBar = opts?.hideTabBar ? null : container.createDiv({ cls: "any-viewer-sheet-tabs" });
  const content = container.createDiv({ cls: "any-viewer-sheet-content" });

  const show = (name: string) => {
    content.empty();
    const html = XLSX.utils.sheet_to_html(wb.Sheets[name], { header: "", footer: "" });
    // Parse instead of innerHTML assignment; only the <table> is adopted.
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const table = parsed.querySelector("table");
    if (!table) {
      content.createDiv({ cls: "any-viewer-empty", text: emptySheet });
      return;
    }
    const adopted = document.importNode(table, true);
    adopted.addClass("any-viewer-sheet-table");
    if (opts?.range) sliceSheetTable(adopted, opts.range);
    if (!adopted.rows.length) {
      content.createDiv({ cls: "any-viewer-empty", text: emptySheet });
      return;
    }
    content.appendChild(adopted);
  };

  const buttons = tabBar
    ? names.map((name) =>
        tabBar.createEl("button", {
          cls: "any-viewer-tab",
          text: name,
          attr: { type: "button", role: "tab", "aria-selected": "false" },
        })
      )
    : [];
  const activate = (i: number) => {
    buttons.forEach((b, j) => {
      b.classList.toggle("is-active", j === i);
      b.setAttribute("aria-selected", j === i ? "true" : "false");
    });
    show(names[i]);
  };
  buttons.forEach((btn, i) => {
    btn.addEventListener("click", () => activate(i));
  });

  activate(activeIndex);
}

/**
 * Clip a SheetJS-rendered table (one <tr> per row, cells possibly carrying
 * colspan) down to `range`. Rows are dropped by absolute index; for columns a
 * colspan-aware cursor walks each row and trims cells to the column window.
 * Known simplification: rowspans crossing the range edge are not re-balanced
 * (rare in xls/csv/tsv).
 */
function sliceSheetTable(table: HTMLTableElement, range: CellRange): void {
  Array.from(table.rows).forEach((tr, idx) => {
    const r = idx + 1;
    if (r < range.sr || r > range.er) tr.remove();
  });
  if (range.sc > 1 || range.ec > 0) {
    Array.from(table.rows).forEach((tr) => {
      let cursor = 1;
      Array.from(tr.cells).forEach((td) => {
        const span = parseInt(td.getAttribute("colspan") ?? "1", 10) || 1;
        const from = cursor;
        const to = cursor + span - 1;
        cursor += span;
        if (range.ec <= 0) {
          // row form: only a left bound — trim columns before sc
          if (to < range.sc) {
            td.remove();
          } else if (from < range.sc) {
            const keepLen = to - range.sc + 1;
            if (keepLen > 1) td.setAttribute("colspan", String(keepLen));
            else td.removeAttribute("colspan");
          }
          return;
        }
        const keepFrom = Math.max(from, range.sc);
        const keepTo = Math.min(to, range.ec);
        if (keepFrom > keepTo) {
          td.remove();
          return;
        }
        const keepLen = keepTo - keepFrom + 1;
        if (keepLen !== span) {
          if (keepLen > 1) td.setAttribute("colspan", String(keepLen));
          else td.removeAttribute("colspan");
        }
      });
    });
  }
}
