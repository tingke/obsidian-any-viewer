import { renderAsync } from "docx-preview";
import type { PageRange } from "./fragment";

/** Render a .docx into `container` (high fidelity via docx-preview). */
export async function renderDocx(container: HTMLElement, data: ArrayBuffer, opts?: { pageRange?: PageRange }): Promise<void> {
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
  applyDocxPageRange(box, opts?.pageRange);
}

/**
 * Hide pages outside `range`. docx-preview (breakPages: true) renders one
 * `section.docx` per page inside `.docx-wrapper`. Hiding keeps the DOM intact
 * (the library indexes sections internally). Ranges starting past the end fall
 * back to the whole document; open/overflowing ends clamp to the last page.
 */
function applyDocxPageRange(box: HTMLElement, range?: PageRange): void {
  if (!range) return;
  // renderAsync usually resolves with the DOM already built; retry a few
  // frames defensively so slow layout can't skip the page hiding.
  let tries = 0;
  const apply = () => {
    const pages = Array.from(box.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx"));
    if (!pages.length) {
      if (tries++ < 20) window.requestAnimationFrame(apply);
      else console.warn("[Any Viewer] docx pages never appeared — page range not applied");
      return;
    }
    if (range.start > pages.length) {
      console.warn(`[Any Viewer] page range starts at ${range.start} but the document has ${pages.length} page(s) — rendering the whole document`);
      return;
    }
    const end = range.end === Number.POSITIVE_INFINITY ? pages.length : Math.min(range.end, pages.length);
    pages.forEach((page, i) => {
      const n = i + 1;
      if (n < range.start || n > end) page.addClass("any-viewer-hidden");
    });
  };
  apply();
}
