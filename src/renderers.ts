import { TFile } from "obsidian";
import type AnyViewerPlugin from "./main";
import { buildFileCard } from "./card";
import { renderDocx } from "./docx";
import type { PageRange, ParsedFragment } from "./fragment";
import { renderHtmlFrame } from "./html";
import { renderPptx } from "./pptx";
import { renderSheet, type SheetRenderOpts } from "./sheet";
import { DOCX_EXTS, HTML_EXTS, PPTX_EXTS, SHEET_EXTS } from "./util";
import { t } from "./i18n";

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

/** Per-embed rendering options (sizes, header bar, html scripts, fragment). */
export interface RenderIntoOptions {
  /** Display width hint in px (from `![[file|300]]` / width attr). */
  widthHint?: number;
  /** Display height hint in px (from `![[file|300x200]]` / height attr). */
  heightHint?: number;
  /** Slide width for pptx rendering (px). */
  pptxWidth?: number;
  /** Slide viewport height for pptx rendering (px). */
  pptxHeight?: number;
  /** Max height in px (embeds only; views fill the pane). */
  maxHeight?: number;
  /** Show filename header bar with actions. */
  showHeader?: boolean;
  /** Allow JavaScript inside embedded HTML files. */
  allowScripts?: boolean;
  /** Display-syntax fragment for INLINE embeds — renderers clip to it. */
  frag?: ParsedFragment;
  /** Display-syntax fragment for TAB/locate mode — render the FULL file, then bring this position into view. */
  locate?: ParsedFragment;
}

/** Card renderers draw without file bytes; binary renderers get real data. */
export const EMPTY_DATA = new ArrayBuffer(0);

/** Everything a renderer needs to draw one file into a stage element. */
export interface RenderContext {
  plugin: AnyViewerPlugin;
  file: TFile;
  /** The `.any-viewer-frame` root (width fallbacks). */
  host: HTMLElement;
  /** The `.any-viewer-stage` container to render into. */
  stage: HTMLElement;
  /** File bytes; `EMPTY_DATA` for renderers that skip reading (card). */
  data: ArrayBuffer;
  frag?: ParsedFragment;
  opts: RenderIntoOptions;
}

/**
 * One renderer per supported kind. Concrete subclasses own everything
 * kind-specific: scroll behavior, fragment → options mapping, and the call
 * into the underlying engine. Adding a format = one subclass + one registry
 * entry; embed/tab plumbing (header, loading, errors, fragments) stays shared.
 */
export abstract class FileRenderer {
  abstract readonly kind: RenderKind;
  /** Renders its own scrolling surface (pptx/html) — stage gets no scroll clamp. */
  readonly selfScrolling: boolean = false;
  /** Read the file bytes before render; card renderers draw without them. */
  readonly needsBinary: boolean = true;

  abstract render(ctx: RenderContext): Promise<void>;

  /**
   * Locate mode (tab view): called after a full unclipped render to bring the
   * fragment position into view (scroll/activate). Default: nothing to do.
   */
  locate?(ctx: RenderContext): void;
}

/** Fragment (display syntax) → pptx/docx page range, if applicable. */
function pagesOf(frag?: ParsedFragment): PageRange | undefined {
  return frag?.type === "pages" ? { start: frag.start, end: frag.end } : undefined;
}

/** Fragment (display syntax) → sheet renderer options (active sheet, range).
 *  Fragment embeds scope to one region — the sheet tab bar stays hidden. */
function sheetOptsOf(frag?: ParsedFragment): SheetRenderOpts | undefined {
  if (!frag) return undefined;
  const base: SheetRenderOpts = { hideTabBar: true };
  if (frag.type === "sheet") return { ...base, activeSheetName: frag.name };
  if (frag.type === "sheetRange") return { ...base, activeSheetName: frag.sheet, range: frag.range };
  return base;
}

/** Fragment → sheet options for LOCATE mode: activate the sheet, never clip. */
function sheetLocateOpts(frag?: ParsedFragment): SheetRenderOpts | undefined {
  if (!frag) return undefined;
  if (frag.type === "sheet") return { activeSheetName: frag.name };
  if (frag.type === "sheetRange") return { activeSheetName: frag.sheet };
  return undefined;
}

export class DocxRenderer extends FileRenderer {
  readonly kind = "docx" as const;

  async render(ctx: RenderContext): Promise<void> {
    await renderDocx(ctx.stage, ctx.data, { pageRange: ctx.opts.locate ? undefined : pagesOf(ctx.frag) });
  }

  locate(ctx: RenderContext): void {
    const frag = ctx.opts.locate;
    if (frag?.type !== "pages") return;
    ctx.stage.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx")[frag.start - 1]?.scrollIntoView({ block: "start" });
  }
}

export class SheetRenderer extends FileRenderer {
  readonly kind = "sheet" as const;

  async render(ctx: RenderContext): Promise<void> {
    const opts = ctx.opts.locate ? sheetLocateOpts(ctx.opts.locate) : sheetOptsOf(ctx.frag);
    await renderSheet(ctx.stage, ctx.file, ctx.data, t(ctx.plugin.settings), opts);
  }

  locate(ctx: RenderContext): void {
    const frag = ctx.opts.locate;
    if (frag?.type === "sheetRange" && frag.range.sr > 1) {
      ctx.stage
        .querySelector<HTMLElement>(`.any-viewer-sheet-content table tr:nth-child(${frag.range.sr})`)
        ?.scrollIntoView({ block: "start" });
    }
  }
}

export class PptxRenderer extends FileRenderer {
  readonly kind = "pptx" as const;
  readonly selfScrolling = true;

  async render(ctx: RenderContext): Promise<void> {
    ctx.stage.addClass("no-scroll"); // the pptx viewer scrolls internally
    const width = ctx.opts.pptxWidth ?? Math.max(480, Math.min(960, ctx.stage.clientWidth || ctx.host.clientWidth || 800));
    const height = ctx.opts.pptxHeight ?? Math.round((width * 9) / 16);
    renderPptx(ctx.stage, ctx.data, width, height, {
      pageRange: ctx.opts.locate ? undefined : pagesOf(ctx.frag),
      locatePage: pagesOf(ctx.opts.locate)?.start,
    });
  }
}

export class HtmlRenderer extends FileRenderer {
  readonly kind = "html" as const;
  readonly selfScrolling = true;

  async render(ctx: RenderContext): Promise<void> {
    // Vault.getResourcePath(path) is a documented API since 1.7.2.
    const resourceUrl = ctx.plugin.app.vault.getResourcePath(ctx.file);
    const anchorId = ctx.frag?.type === "element" ? ctx.frag.id : ctx.opts.locate?.type === "element" ? ctx.opts.locate.id : undefined;
    await renderHtmlFrame(ctx.stage, ctx.data, {
      allowScripts: ctx.opts.allowScripts ?? true,
      height: ctx.opts.heightHint,
      maxHeight: ctx.opts.maxHeight,
      resourceUrl,
      scrollToId: anchorId,
    });
  }
}

export class CardRenderer extends FileRenderer {
  readonly kind = "card" as const;
  readonly needsBinary = false;

  async render(ctx: RenderContext): Promise<void> {
    // With the header bar shown, the artwork+copy row replaces the old card box.
    ctx.stage.appendChild(buildFileCard(ctx.plugin, ctx.file, { headerShown: ctx.opts.showHeader !== false }));
  }
}

const REGISTRY: Record<RenderKind, FileRenderer> = {
  docx: new DocxRenderer(),
  sheet: new SheetRenderer(),
  pptx: new PptxRenderer(),
  html: new HtmlRenderer(),
  card: new CardRenderer(),
};

/** Renderer for a dispatch kind (see kindForExt). */
export function getRenderer(kind: RenderKind): FileRenderer {
  return REGISTRY[kind];
}
