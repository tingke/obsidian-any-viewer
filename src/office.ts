import { renderAsync } from "docx-preview";
import { init as pptxInit } from "pptx-preview";
import * as XLSX from "xlsx";
import { DOCX_EXTS, HTML_EXTS, PPTX_EXTS, SHEET_EXTS } from "./util";

export type RenderKind = "docx" | "sheet" | "pptx" | "html" | "card";

/** Map a lowercase extension to the renderer kind, honoring the enabled toggles. */
export function kindForExt(ext: string, opts: { docx: boolean; sheet: boolean; pptx: boolean; html: boolean; card: boolean }): RenderKind | null {
  if (DOCX_EXTS.includes(ext)) return opts.docx ? "docx" : opts.card ? "card" : null;
  if (SHEET_EXTS.includes(ext)) return opts.sheet ? "sheet" : opts.card ? "card" : null;
  if (PPTX_EXTS.includes(ext)) return opts.pptx ? "pptx" : opts.card ? "card" : null;
  if (HTML_EXTS.includes(ext)) return opts.html ? "html" : opts.card ? "card" : null;
  return opts.card ? "card" : null;
}

/** Render a .docx into `container` (high fidelity via docx-preview). */
export async function renderDocx(container: HTMLElement, data: ArrayBuffer): Promise<void> {
  const box = container.createDiv({ cls: "any-viewer-docx" });
  await renderAsync(new Blob([data]), box, undefined, {
    inWrapper: true,
    breakPages: true,
    ignoreLastRenderedPageBreak: true,
  });
}

/** Render a spreadsheet (xlsx/xls/csv/tsv) into `container`, with sheet tabs. */
export function renderSheet(container: HTMLElement, data: ArrayBuffer): void {
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
    if (table) content.appendChild(table);
    else content.createDiv({ cls: "any-viewer-empty", text: "（该工作表为空）" });
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

/** Render a .pptx into `container` at the given slide width. */
export function renderPptx(container: HTMLElement, data: ArrayBuffer, width: number): void {
  const wrap = container.createDiv({ cls: "any-viewer-pptx" });
  const w = Math.max(320, Math.min(1280, Math.round(width) || 960));
  const viewer = pptxInit(wrap, { width: w, height: Math.round((w * 9) / 16) });
  viewer.preview(data);
}
