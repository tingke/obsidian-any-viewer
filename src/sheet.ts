import * as ExcelJSNS from "exceljs";
import * as XLSX from "xlsx";
import { TFile } from "obsidian";
import * as JSZipNS from "jszip";

const ExcelJS: any = (ExcelJSNS as any).default ?? ExcelJSNS;
const JSZip: any = (JSZipNS as any).default ?? JSZipNS;

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
    for (const m of scheme.matchAll(/<a:(dk1|lt1|dk2|lt2|accent[1-6])>([\s\S]*?)<\/a:\1>/g)) {
      const srgb = /<a:srgbClr val="([0-9A-Fa-f]{6})"/.exec(m[2])?.[1];
      const sys = /<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"/.exec(m[2])?.[1];
      byName[m[1]] = `#${(srgb ?? sys ?? "000000").toUpperCase()}`;
    }
    // Excel's theme color index order differs from the XML order:
    // 0=lt1, 1=dk1, 2=lt2, 3=dk2, 4..9=accent1..6
    return [byName.lt1, byName.dk1, byName.lt2, byName.dk2, byName.accent1, byName.accent2, byName.accent3, byName.accent4, byName.accent5, byName.accent6];
  } catch (e) {
    console.warn("[Any Viewer] theme palette extraction failed:", e);
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

/** Resolve any xlsx color shape (argb / rgb / theme+tint / indexed) to CSS. */
function resolveColor(color: any, palette: ThemePalette): string | null {
  if (!color) return null;
  const raw = typeof color === "string" ? color : color.argb ?? color.rgb;
  if (typeof raw === "string" && /^[0-9A-Fa-f]{6,8}$/.test(raw)) {
    return `#${(raw.length === 8 ? raw.slice(2) : raw).toUpperCase()}`;
  }
  if (color.theme !== undefined && color.theme !== null) {
    const base = palette[color.theme];
    if (base) return applyTint(base, typeof color.tint === "number" ? color.tint : 0);
  }
  return null;
}

/**
 * Spreadsheet renderer with per-cell fidelity:
 * - xlsx/xlsm rendered via exceljs (fills, fonts, borders, merges,
 *   alignment, number formats, column widths, row heights)
 * - csv/tsv/xls and any exceljs parse failure rendered via SheetJS
 */
export async function renderSheet(container: HTMLElement, file: TFile, data: ArrayBuffer): Promise<void> {
  const ext = (file.extension ?? "").toLowerCase();
  if (ext === "xlsx" || ext === "xlsm") {
    try {
      await renderWithExcelJS(container, data);
      return;
    } catch (err) {
      console.warn("[Any Viewer] exceljs render failed, falling back to SheetJS:", err);
      container.empty();
    }
  }
  renderWithSheetJS(container, data);
}

/* ---------------- exceljs (styled) ---------------- */

async function renderWithExcelJS(container: HTMLElement, data: ArrayBuffer): Promise<void> {
  // Theme colors must be read before exceljs touches the buffer.
  const palette = await loadThemePalette(data);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  if (!wb.worksheets || !wb.worksheets.length) {
    container.createDiv({ cls: "any-viewer-empty", text: "（空工作簿）" });
    return;
  }

  const tabBar = container.createDiv({ cls: "any-viewer-sheet-tabs" });
  const content = container.createDiv({ cls: "any-viewer-sheet-content" });

  const show = (ws: any) => {
    content.empty();
    renderWorksheetExcelJS(content, ws, palette);
  };

  wb.worksheets.forEach((ws: any, i: number) => {
    const btn = tabBar.createEl("button", {
      cls: `any-viewer-tab${i === 0 ? " is-active" : ""}`,
      text: ws.name,
      attr: { type: "button" },
    });
    btn.addEventListener("click", () => {
      tabBar.querySelectorAll(".any-viewer-tab").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      show(ws);
    });
  });

  show(wb.worksheets[0]);
}

function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** "B3:D5" -> {sc, sr, ec, er} (1-based inclusive) */
function parseRange(ref: string): { sc: number; sr: number; ec: number; er: number } | null {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref?.trim?.() ?? "");
  if (!m) return null;
  return {
    sc: colToIndex(m[1].toUpperCase()),
    sr: parseInt(m[2], 10),
    ec: colToIndex(m[3].toUpperCase()),
    er: parseInt(m[4], 10),
  };
}

function argbToCss(color: any): string | null {
  // legacy helper kept for raw hex strings
  if (!color) return null;
  const raw = typeof color === "string" ? color : color.argb ?? color.rgb;
  if (typeof raw === "string" && /^[0-9A-Fa-f]{6,8}$/.test(raw)) {
    return `#${(raw.length === 8 ? raw.slice(2) : raw).toUpperCase()}`;
  }
  return null;
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

function borderCss(side: any, palette: ThemePalette): string | null {
  if (!side || !side.style) return null;
  const kind = BORDER_CSS[side.style] ?? "1px solid";
  const color = resolveColor(side.color, palette) ?? "rgba(140,140,140,.6)";
  return `${kind} ${color}`;
}

function valueText(value: any): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatDate(value);
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((f: any) => f.text ?? "").join("");
    if (value.result !== undefined && value.result !== null) {
      return value.result instanceof Date ? formatDate(value.result) : String(value.result);
    }
    if (value.text !== undefined) return String(value.text);
    if (value.formula !== undefined) return String(value.formula);
    if (value.error !== undefined) return `#${value.error}`;
    if (Array.isArray(value)) return (value as any[]).map((v) => valueText(v)).join(" ");
    return "";
  }
  return String(value);
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
function formatValue(value: any, numFmt: string | undefined): string {
  const raw = valueText(value);
  if (numFmt && typeof value === "number" && Number.isFinite(value)) {
    try {
      const fmt = numFmt.toLowerCase();
      if (fmt.includes("%")) {
        const decimals = (fmt.split(".").pop() ?? "").replace(/[^0#]/g, "").length;
        return (value * 100).toFixed(decimals) + "%";
      }
      if (fmt.includes("yy") || fmt.includes("dd") || fmt.includes("mm")) return raw;
      const decimals = (fmt.split(".").pop() ?? "").replace(/[^0#]/g, "").length;
      if (fmt.includes(",")) {
        return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }
      if (decimals > 0) return value.toFixed(decimals);
    } catch (e) {
      /* fall back to raw */
    }
  }
  return raw;
}

function cellStyleCss(cell: any, palette: ThemePalette): string {
  const style = cell.style ?? {};
  const parts: string[] = [];

  const font = style.font ?? {};
  if (font.bold) parts.push("font-weight:700");
  if (font.italic) parts.push("font-style:italic");
  if (font.underline) parts.push("text-decoration:underline");
  if (font.strike) parts.push("text-decoration:line-through");
  if (font.size) parts.push(`font-size:${Math.min(font.size, 20)}pt`);
  const fontColor = resolveColor(font.color, palette);
  if (fontColor) parts.push(`color:${fontColor}`);
  if (font.name) parts.push(`font-family:'${String(font.name).replace(/'/g, "")}',sans-serif`);

  const fill = style.fill;
  if (fill && (fill.pattern === "solid" || fill.type === "solid")) {
    const bg = resolveColor(fill.fgColor, palette) ?? resolveColor(fill.bgColor, palette);
    if (bg && bg.toUpperCase() !== "#FFFFFF") parts.push(`background:${bg}`);
  }

  const b = style.border ?? {};
  const top = borderCss(b.top, palette), bottom = borderCss(b.bottom, palette), left = borderCss(b.left, palette), right = borderCss(b.right, palette);
  if (top || bottom || left || right) {
    parts.push(`border:${top ?? "none"}`);
    if (top && bottom) parts.push(`border-bottom:${bottom}`);
    if (left) parts.push(`border-left:${left}`);
    if (right) parts.push(`border-right:${right}`);
  }

  const align = style.alignment ?? {};
  if (align.horizontal) parts.push(`text-align:${align.horizontal}`);
  if (align.vertical) parts.push(`vertical-align:${align.vertical === "center" ? "middle" : align.vertical}`);
  if (align.wrapText) parts.push("white-space:pre-wrap");

  return parts.join(";");
}

function renderWorksheetExcelJS(content: HTMLElement, ws: any, palette: ThemePalette): void {
  const rowCount = Math.min(ws.rowCount ?? 0, MAX_ROWS);
  const colCount = Math.min(ws.columnCount ?? 0, MAX_COLS);
  if (!rowCount || !colCount) {
    content.createDiv({ cls: "any-viewer-empty", text: "（该工作表为空）" });
    return;
  }

  // Merge map: master cell -> range; covered cell -> master coords
  // (exceljs exposes merge ranges on ws.model.merges, not ws.merges)
  const mergeRefs: string[] = ws.model?.merges ?? ws.merges ?? [];
  const masterOf = new Map<string, string>();
  const spanOf = new Map<string, { colspan: number; rowspan: number }>();
  for (const ref of mergeRefs) {
    const range = parseRange(ref);
    if (!range) continue;
    spanOf.set(`${range.sr},${range.sc}`, {
      colspan: range.ec - range.sc + 1,
      rowspan: range.er - range.sr + 1,
    });
    for (let r = range.sr; r <= range.er; r++) {
      for (let c = range.sc; c <= range.ec; c++) {
        if (r !== range.sr || c !== range.sc) masterOf.set(`${r},${c}`, `${range.sr},${range.sc}`);
      }
    }
  }

  const table = content.createEl("table", { cls: "any-viewer-sheet-table" });

  const colgroup = table.createEl("colgroup");
  for (let c = 1; c <= colCount; c++) {
    let width: number | undefined;
    try {
      width = ws.getColumn(c)?.width;
    } catch (e) {
      /* ignore */
    }
    const col = colgroup.createEl("col");
    if (width && width > 0) col.style.width = `${Math.min(Math.round(width * 7 + 5), 400)}px`;
  }

  const rows = new Map<number, any>();
  for (let r = 1; r <= rowCount; r++) {
    const tr = table.createEl("tr");
    let height: number | undefined;
    try {
      height = ws.getRow(r)?.height;
    } catch (e) {
      /* ignore */
    }
    if (height && height > 0) tr.style.height = `${Math.round(height * 1.333)}px`;
    rows.set(r, tr);
  }

  for (let r = 1; r <= rowCount; r++) {
    const tr = rows.get(r)!;
    for (let c = 1; c <= colCount; c++) {
      if (masterOf.has(`${r},${c}`)) continue; // covered by a merge
      let cell: any = null;
      try {
        cell = ws.getRow(r).getCell(c);
      } catch (e) {
        cell = null;
      }
      const td = tr.createEl("td");
      const span = spanOf.get(`${r},${c}`);
      if (span) {
        if (span.colspan > 1) td.setAttribute("colspan", String(span.colspan));
        if (span.rowspan > 1) td.setAttribute("rowspan", String(span.rowspan));
      }
      const css = cell ? cellStyleCss(cell, palette) : "";
      if (css) td.setAttribute("style", css);

      let text = "";
      let href: string | null = null;
      if (cell) {
        text = formatValue(cell.value, cell.numFmt);
        const v = cell.value;
        if (v && typeof v === "object" && typeof v.hyperlink === "string" && /^https?:\/\//i.test(v.hyperlink)) {
          href = v.hyperlink;
        }
      }
      if (href) {
        td.createEl("a", { text, href, attr: { target: "_blank", rel: "noopener" } });
      } else {
        td.setText(text);
      }
    }
  }

  if ((ws.rowCount ?? 0) > MAX_ROWS || (ws.columnCount ?? 0) > MAX_COLS) {
    content.createDiv({
      cls: "any-viewer-sheet-truncated",
      text: `表格过大，已截断显示前 ${MAX_ROWS} 行 × ${MAX_COLS} 列（在标签页中打开可查看完整数据）`,
    });
  }
}

/* ---------------- SheetJS (plain) ---------------- */

function renderWithSheetJS(container: HTMLElement, data: ArrayBuffer): void {
  const wb = XLSX.read(new Uint8Array(data), { type: "array" });
  const names = wb.SheetNames;
  if (!names.length) {
    container.createDiv({ cls: "any-viewer-empty", text: "（空工作簿）" });
    return;
  }

  const tabBar = container.createDiv({ cls: "any-viewer-sheet-tabs" });
  const content = container.createDiv({ cls: "any-viewer-sheet-content" });

  const show = (name: string) => {
    content.empty();
    const html = XLSX.utils.sheet_to_html(wb.Sheets[name], { header: "", footer: "" });
    const holder = createDiv();
    holder.innerHTML = html;
    const table = holder.querySelector("table");
    if (table) {
      table.addClass("any-viewer-sheet-table");
      content.appendChild(table);
    } else {
      content.createDiv({ cls: "any-viewer-empty", text: "（该工作表为空）" });
    }
    holder.remove();
  };

  names.forEach((name, i) => {
    const btn = tabBar.createEl("button", {
      cls: `any-viewer-tab${i === 0 ? " is-active" : ""}`,
      text: name,
      attr: { type: "button" },
    });
    btn.addEventListener("click", () => {
      tabBar.querySelectorAll(".any-viewer-tab").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      show(name);
    });
  });

  show(names[0]);
}
