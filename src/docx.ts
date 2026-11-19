import { renderAsync } from "docx-preview";
import type { PageRange } from "./fragment";

/** One outline entry: a heading paragraph found in the rendered document. */
export interface DocxOutlineEntry {
  /** Heading level 1–9. */
  level: number;
  /** Heading text (trimmed). */
  text: string;
  /** The rendered paragraph element — click-to-scroll target. */
  el: HTMLElement;
  /** 1-based page number the heading appears on. */
  page: number;
}

/**
 * docx-preview appends the paragraph style id to each element's class
 * (`processStyleName` → `escapeClassName` LOWERCASES it, so Heading1 renders
 * as `docx_heading1`). Word writes canonical "Heading1".."Heading9" style ids
 * regardless of UI language, so the rendered DOM alone identifies headings —
 * no styles.xml parsing needed. Documents from generators that use
 * non-canonical style ids simply show no outline (silent).
 */
const HEADING_CLASS = /(?:^|\s)docx_heading(\d)(?:\s|$)/;

/** Render a .docx into `container` (high fidelity via docx-preview). */
export async function renderDocx(
  container: HTMLElement,
  data: ArrayBuffer,
  opts?: { pageRange?: PageRange; heading?: string }
): Promise<void> {
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
  if (opts?.heading) await applyDocxHeadingClip(box, opts.heading);
  applyDocxPageRange(box, opts?.pageRange);
}

/**
 * Build the outline from the rendered DOM (call after renderAsync resolved):
 * walk heading paragraphs in document order, resolving each one's page via its
 * ancestor `section.docx`.
 */
export function buildDocxOutline(box: HTMLElement): DocxOutlineEntry[] {
  const pages = Array.from(box.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx"));
  const entries: DocxOutlineEntry[] = [];
  for (const el of Array.from(box.querySelectorAll<HTMLElement>(".docx-wrapper p"))) {
    const m = HEADING_CLASS.exec(el.className);
    if (!m) continue;
    const text = (el.textContent ?? "").trim();
    if (!text) continue;
    const section = el.closest("section.docx");
    const page = pages.indexOf(section as HTMLElement) + 1;
    entries.push({ level: parseInt(m[1], 10), text, el, page: page > 0 ? page : 1 });
  }
  return entries;
}

/** Find the first heading paragraph matching `text` (exact, then prefix). */
export function findDocxHeading(box: HTMLElement, text: string): HTMLElement | null {
  const headings = Array.from(box.querySelectorAll<HTMLElement>(".docx-wrapper p")).filter((p) => HEADING_CLASS.test(p.className));
  const needle = text.trim().toLowerCase();
  return (
    headings.find((p) => (p.textContent ?? "").trim().toLowerCase() === needle) ??
    headings.find((p) => (p.textContent ?? "").trim().toLowerCase().startsWith(needle)) ??
    null
  );
}

/**
 * `#标题` fragment (frag semantics): clip from the heading's page to the end —
 * equivalent to `page=N~` where N is the heading's page. Unresolved heading →
 * whole document (silent fallback, consistent with out-of-range page specs).
 */
async function applyDocxHeadingClip(box: HTMLElement, text: string): Promise<void> {
  // renderAsync usually resolves with the DOM already built; retry a few
  // frames defensively (same rationale as applyDocxPageRange).
  let tries = 0;
  const apply = () => {
    const target = findDocxHeading(box, text);
    if (!target) {
      if (tries++ < 20) {
        window.requestAnimationFrame(apply);
        return;
      }
      console.warn(`[Any Viewer] docx heading "${text}" not found — rendering the whole document`);
      return;
    }
    const pages = Array.from(box.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx"));
    const section = target.closest("section.docx");
    const page = pages.indexOf(section as HTMLElement) + 1;
    if (page > 1) applyDocxPageRange(box, { start: page, end: Number.POSITIVE_INFINITY });
  };
  apply();
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
