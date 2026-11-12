import { init as pptxInit } from "pptx-preview";
import type { PageRange } from "./fragment";

interface PptxRenderOpts {
  /** Embed mode: hide slides outside the range. */
  pageRange?: PageRange;
  /** Locate mode (tab view): full deck, then scroll this slide to the top. */
  locatePage?: number;
}

/** Render a .pptx into `container` with the given slide viewport size. */
export function renderPptx(container: HTMLElement, data: ArrayBuffer, width: number, height: number, opts?: PptxRenderOpts): void {
  const wrap = container.createDiv({ cls: "any-viewer-pptx" });
  const w = Math.max(320, Math.min(1600, Math.round(width) || 960));
  const h = Math.max(180, Math.round(height) || Math.round((w * 9) / 16));
  const viewer = pptxInit(wrap, { width: w, height: h });
  viewer.preview(data);

  const range = opts?.pageRange;
  const locatePage = opts?.locatePage;
  if (!range && !locatePage) return;
  // pptx-preview builds its slides INCREMENTALLY — the first frame may only
  // contain slide 1 (or none). Applying the range / locating too early would
  // leak every slide rendered afterwards, so wait until the slide count has
  // stopped growing (stable for a few consecutive frames), capped at ~4s.
  let last = -1;
  let stable = 0;
  let tries = 0;
  const tick = () => {
    const slides = Array.from(wrap.querySelectorAll<HTMLElement>(".pptx-preview-slide-wrapper"));
    const count = slides.length;
    stable = count > 0 && count === last ? stable + 1 : 0;
    last = count;
    if (count > 0 && stable >= 6) {
      if (range) applyPptxPageRange(wrap, slides, range);
      if (locatePage) locatePptxSlide(slides, locatePage);
      return;
    }
    if (++tries <= 240) window.requestAnimationFrame(tick);
    else if (count > 0) {
      if (range) applyPptxPageRange(wrap, slides, range);
      if (locatePage) locatePptxSlide(slides, locatePage);
    } else console.warn("[Any Viewer] pptx slides never appeared — page range not applied");
  };
  window.requestAnimationFrame(tick);
}

/**
 * Hide slides outside `range` (pptx-preview 1.0.7: one
 * `.pptx-preview-slide-wrapper` per slide, stacked vertically with position
 * relative inside `.pptx-preview-wrapper`, which carries an INLINE height =
 * our viewport estimate). A single-page range collapses both wrappers to the
 * rendered slide height so the embed shows exactly one slide with no internal
 * scrollbars; multi-page ranges keep the fixed viewport height and the slides
 * scroll inside — exactly like a full-deck embed.
 */
function applyPptxPageRange(wrap: HTMLElement, slides: HTMLElement[], range: PageRange): void {
  if (range.start > slides.length) {
    console.warn(`[Any Viewer] page range starts at ${range.start} but the deck has ${slides.length} slide(s) — rendering the whole deck`);
    return;
  }
  const end = range.end === Number.POSITIVE_INFINITY ? slides.length : Math.min(range.end, slides.length);
  slides.forEach((slide, i) => {
    const n = i + 1;
    if (n < range.start || n > end) slide.addClass("any-viewer-hidden");
  });
  const visible = slides.filter((slide) => !slide.hasClass("any-viewer-hidden"));
  if (visible.length === 1) {
    wrap.querySelectorAll<HTMLElement>(".pptx-preview-wrapper").forEach((el) => el.setCssProps({ height: "auto", overflow: "visible" }));
    wrap.setCssProps({ height: "auto" });
    // +10px = the slide's own bottom margin, so nothing gets clipped.
    const h = visible[0].getBoundingClientRect().height;
    if (h > 0) wrap.setCssProps({ height: `${Math.ceil(h) + 10}px`, overflow: "hidden" });
  }
}

/** Locate mode (tab view): scroll the requested slide to the top of the deck. */
function locatePptxSlide(slides: HTMLElement[], page: number): void {
  if (page < 1 || page > slides.length) return;
  slides[page - 1]?.scrollIntoView({ block: "start" });
}
