import { renderAsync } from "docx-preview";
import { init as pptxInit } from "pptx-preview";
import { DOCX_EXTS, HTML_EXTS, PPTX_EXTS, SHEET_EXTS } from "./util";

export type RenderKind = "docx" | "sheet" | "pptx" | "html" | "card";

/** Map a lowercase extension to the renderer kind; disabled formats are skipped entirely
 *  (leaving them to Obsidian or other plugins), unknown types fall back to the card. */
export function kindForExt(ext: string, opts: { docx: boolean; sheet: boolean; pptx: boolean; html: boolean; card: boolean }): RenderKind | null {
  if (DOCX_EXTS.includes(ext)) return opts.docx ? "docx" : null;
  if (SHEET_EXTS.includes(ext)) return opts.sheet ? "sheet" : null;
  if (PPTX_EXTS.includes(ext)) return opts.pptx ? "pptx" : null;
  if (HTML_EXTS.includes(ext)) return opts.html ? "html" : null;
  return opts.card ? "card" : null;
}

/** Render a .docx into `container` (high fidelity via docx-preview). */
export async function renderDocx(container: HTMLElement, data: ArrayBuffer): Promise<void> {
  const box = container.createDiv({ cls: "any-viewer-docx" });
  await renderAsync(new Blob([data]), box, undefined, {
    inWrapper: true,
    breakPages: true,
    ignoreLastRenderedPageBreak: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
    useBase64URL: true,
  });
}

/** Render a .pptx into `container` with the given slide viewport size. */
export function renderPptx(container: HTMLElement, data: ArrayBuffer, width: number, height: number): void {
  const wrap = container.createDiv({ cls: "any-viewer-pptx" });
  const w = Math.max(320, Math.min(1600, Math.round(width) || 960));
  const h = Math.max(180, Math.round(height) || Math.round((w * 9) / 16));
  const viewer = pptxInit(wrap, { width: w, height: h });
  viewer.preview(data);
}
