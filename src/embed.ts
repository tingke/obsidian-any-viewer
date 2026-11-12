import { MarkdownPostProcessorContext, MarkdownView, Notice, TFile, getIcon } from "obsidian";
import AnyViewerPlugin from "./main";
import { buildFileCard } from "./card";
import { addHeaderAction } from "./chrome";
import { OPEN_END, formatCellRange, parseFragment } from "./fragment";
import type { ParsedFragment } from "./fragment";
import { EMPTY_DATA, getRenderer, kindForExt, type RenderContext, type RenderIntoOptions, type RenderKind } from "./renderers";
import { isNativeExt, openFileExternally, openFileWithFragment, resolveByBasename } from "./util";
import { t } from "./i18n";
import type { Dict } from "./i18n";

// The interface itself lives with the renderer classes it feeds.
export type { RenderIntoOptions } from "./renderers";

/** Hard cap for one renderer.run — a hung parse must not block the queue. */
const RENDER_TIMEOUT_MS = 20_000;

let renderChain: Promise<unknown> = Promise.resolve();

/**
 * Serialize heavy renders. exceljs / docx-preview hold module-level state and
 * can deadlock when many instances parse the same file type concurrently
 * (observed as never-resolving render promises with an empty stage). Embeds
 * queue through this chain; every task is timeout-capped so one stuck render
 * surfaces an error instead of blocking all the others.
 */
function enqueueRender(task: () => Promise<void>): Promise<void> {
  const run = renderChain.then(task, task);
  renderChain = run.catch(() => {});
  return run;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`render timed out after ${Math.round(ms / 1000)}s: ${label}`)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/** Render `file` (of the given kind) into `host`. Shared by embeds and the tab view. */
export async function renderFileInto(plugin: AnyViewerPlugin, host: HTMLElement, file: TFile, kind: RenderKind, opts: RenderIntoOptions = {}): Promise<void> {
  const app = plugin.app;
  const T = t(plugin.settings);
  const frag = opts.frag;
  const renderer = getRenderer(kind);
  host.empty();
  host.addClass("any-viewer-frame");

  if (opts.showHeader !== false) {
    const header = host.createDiv({ cls: "any-viewer-header" });
    const icon = getIcon("file");
    if (icon) {
      const iconWrap = header.createDiv({ cls: "any-viewer-header-icon" });
      iconWrap.appendChild(icon as unknown as HTMLElement);
    }
    const title = header.createDiv({ cls: "any-viewer-header-title", text: file.name });
    const badge = fragmentBadgeText(frag, T);
    if (badge) title.createSpan({ cls: "any-viewer-header-badge", text: badge });
    title.addClass("is-clickable");
    title.setAttribute("role", "button");
    title.setAttribute("tabindex", "0");
    title.setAttribute("aria-label", T.clickToOpenInTab);
    // Opening the tab LOCATES: the tab renders the full file and jumps to the
    // fragment position (page N / sheet / range start / element anchor),
    // while the inline embed itself stays clipped to the fragment.
    const openInTab = () => void openFileWithFragment(app, file, frag);
    title.addEventListener("click", openInTab);
    title.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
      openInTab();
    });

    addHeaderAction(header, {
      icon: "file-output",
      label: T.openInTab,
      onClick: () => void openFileWithFragment(app, file, frag),
    });

    addHeaderAction(header, {
      icon: "external-link",
      label: T.openWithSystemApp,
      onClick: () => openFileExternally(plugin, file),
    });
  }

  const stage = host.createDiv({ cls: "any-viewer-stage" });
  stage.setAttribute("aria-live", "polite");
  // The card width is applied to the outer embed span (has-width); content keeps
  // its natural size and scrolls inside. pptx & html manage their own scrolling.
  const effectiveHeight = opts.heightHint ?? opts.maxHeight;
  const selfScrolling = kind === "pptx" || kind === "html";
  if (!selfScrolling && (effectiveHeight || opts.widthHint)) {
    if (effectiveHeight) stage.style.maxHeight = `${effectiveHeight}px`;
    stage.addClass("is-scrollable");
  }

  const ctx: RenderContext = { plugin, host, stage, file, data: EMPTY_DATA, frag, opts };
  if (!renderer.needsBinary) {
    // Card kinds draw straight from the file metadata — no bytes to read.
    await renderer.render(ctx);
    return;
  }

  const loading = stage.createDiv({ cls: "any-viewer-loading", text: T.loading });
  stage.setAttribute("aria-busy", "true");
  // Double-click anywhere on the embed content opens the file in a tab (locate mode).
  stage.addEventListener("dblclick", () => {
    void openFileWithFragment(app, file, frag);
  });

  try {
    const data = await app.vault.readBinary(file);
    loading.remove();
    stage.setAttribute("aria-busy", "false");
    await enqueueRender(async () => {
      await withTimeout(renderer.render({ ...ctx, data }), RENDER_TIMEOUT_MS, `${file.name} (${kind})`);
    });
    if (ctx.opts.locate) renderer.locate?.({ ...ctx, data });
  } catch (err) {
    console.error("[Any Viewer] render failed:", err);
    loading.remove();
    stage.setAttribute("aria-busy", "false");
    stage.empty();
    const errBox = stage.createDiv({ cls: "any-viewer-error", text: T.renderFailed(String((err as Error)?.message ?? err)) });
    errBox.appendChild(buildFileCard(plugin, file, { headerShown: opts.showHeader !== false }));
  }
}

/** Short badge text for the embed header title ("第 3–10 页" / "Sheet2 · A1:D10"). */
function fragmentBadgeText(frag: ParsedFragment | undefined, T: Dict): string | null {
  if (!frag) return null;
  switch (frag.type) {
    case "pages":
      if (frag.end === OPEN_END) return T.fragmentPageOpenBadge(frag.start);
      return frag.end > frag.start ? T.fragmentPageRangeBadge(frag.start, frag.end) : T.fragmentPageBadge(frag.start);
    case "sheet":
      return T.fragmentSheetBadge(frag.name);
    case "sheetRange": {
      const prefix = frag.sheet ? `${frag.sheet} · ` : "";
      const rangeText = frag.isRowForm
        ? T.fragmentRowsBadge(frag.range.sr, frag.range.er)
        : formatCellRange(frag.range);
      return T.fragmentRangeBadge(`${prefix}${rangeText}`);
    }
    case "element":
      return T.fragmentElementBadge(frag.id);
  }
}

/**
 * Turns `![[file.docx]]`-style internal embeds of non-native file types into previews.
 *
 * Obsidian resolves internal embeds asynchronously AFTER markdown post processors
 * run, and rewrites the span content with its default chip. So instead of
 * replacing content immediately, we wait until Obsidian has finished (span gets
 * `is-loaded` / child elements), take over the span, and keep a guard observer
 * that re-renders if Obsidian ever rewrites our content again.
 */
export class EmbedRenderer {
  private static readonly TAKEOVER_TIMEOUT_MS = 800;

  /** Live embeds: span -> re-render closure. Lets refreshAll() re-render
   * every connected embed (e.g. right after the UI language changes). */
  private readonly live = new Map<HTMLElement, () => void>();

  constructor(private plugin: AnyViewerPlugin) {}

  /**
   * Re-render every still-connected embed so render-time strings (header
   * buttons, tooltips, sheet messages) follow a language switch instantly.
   * Detached spans are pruned; heavy re-reads are acceptable here because a
   * language switch is a rare, explicit user action.
   */
  refreshAll(): void {
    for (const [span, render] of this.live) {
      if (!span.isConnected) {
        this.live.delete(span);
        continue;
      }
      try {
        render();
      } catch (err) {
        console.error("[Any Viewer] embed refresh failed:", err);
      }
    }
  }

  register(): void {
    this.plugin.registerMarkdownPostProcessor((el, ctx) => this.process(el, ctx));
    // Reading mode renders/unmounts sections progressively as the user scrolls.
    // Postprocessors fire on initial render, but re-created embed chips (scroll
    // far away and back, async embed resolution) can appear WITHOUT another
    // postprocessor run — they'd sit as raw chips for up to forever. A debounced
    // document-wide sweep catches every late chip no matter when it appears.
    this.domObserver = new MutationObserver(() => this.scheduleSweep());
    this.domObserver.observe(document.body, { childList: true, subtree: true });
    this.plugin.register(() => {
      this.domObserver?.disconnect();
      window.clearTimeout(this.sweepTimer);
    });
  }

  private domObserver?: MutationObserver;
  private sweepTimer?: number;

  /** Debounce: bursts of DOM mutations only trigger one sweep. */
  private scheduleSweep(): void {
    if (this.sweepTimer !== undefined) return;
    this.sweepTimer = window.setTimeout(() => {
      this.sweepTimer = undefined;
      this.sweepDocument();
    }, 120);
  }

  /** Take over every not-yet-claimed embed chip currently in the document. */
  private sweepDocument(): void {
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const sourcePath = view?.file?.path ?? "";
    const spans = document.querySelectorAll<HTMLElement>("[class*='internal-embed']:not(.any-viewer-done)");
    for (const span of Array.from(spans)) {
      try {
        this.scheduleTakeover(span, { sourcePath } as MarkdownPostProcessorContext);
      } catch (err) {
        console.error("[Any Viewer] embed sweep failed:", err);
      }
    }
  }

  private process(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    // Class-substring match (not just `span.internal-embed`): Obsidian has
    // been seen rendering file embed chips as divs in some contexts.
    const spans = el.querySelectorAll<HTMLElement>("[class*='internal-embed']");
    for (const span of Array.from(spans)) {
      try {
        this.scheduleTakeover(span, ctx);
      } catch (err) {
        console.error("[Any Viewer] embed processing failed:", err);
      }
    }
  }

  private scheduleTakeover(span: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    if (span.classList.contains("any-viewer-done")) return;

    let src = (span.getAttribute("src") ?? span.getAttribute("data-src") ?? span.textContent ?? "").trim();
    console.debug(`[Any Viewer] embed <${span.tagName.toLowerCase()}> src="${src.slice(0, 80)}"`);
    if (!src) return;
    // Split off the display-syntax fragment BEFORE decoding: "%" of percent
    // escapes must never be confused with a "#" boundary.
    let fragmentRaw = "";
    const hash = src.indexOf("#");
    if (hash >= 0) {
      fragmentRaw = src.slice(hash + 1).trim();
      src = src.slice(0, hash).trim();
    }
    if (!src) return;
    try {
      src = decodeURIComponent(src);
    } catch {
      /* keep raw */
    }
    if (fragmentRaw) {
      try {
        fragmentRaw = decodeURIComponent(fragmentRaw);
      } catch {
        /* keep raw */
      }
    }

    const app = this.plugin.app;
    // Primary: Obsidian's link index. Fallback: basename match across the
    // vault — covers extensions metadataCache doesn't index when "Detect all
    // file extensions" is off (zip, office files, …).
    const file = app.metadataCache.getFirstLinkpathDest(src, ctx.sourcePath) ?? resolveByBasename(app, src, ctx.sourcePath);
    if (!file || !(file instanceof TFile)) {
      console.warn(`[Any Viewer] embed "${src}" not found in vault — leaving Obsidian's own chip`);
      return;
    }

    const ext = (file.extension ?? "").toLowerCase();
    if (!ext || isNativeExt(ext)) return;

    const s = this.plugin.settings;
    const kind = kindForExt(ext, {
      docx: s.enableDocx,
      sheet: s.enableSheet,
      pptx: s.enablePptx,
      html: s.enableHtml,
      card: s.enableFallbackCard,
    });
    if (!kind) {
      console.warn(`[Any Viewer] ".${ext}" not claimed (format toggle off or fallback card off) — skipping this embed`);
      return;
    }

    const frag = fragmentRaw ? (parseFragment(fragmentRaw, kind) ?? undefined) : undefined;
    if (fragmentRaw && !frag) {
      console.warn(`[Any Viewer] unparsed fragment "${fragmentRaw}" on ${file.name} — rendering the whole file`);
    }
    console.debug(`[Any Viewer] take over "${src}" kind=${kind} frag="${fragmentRaw || "—"}"`);

    span.classList.add("any-viewer-done");
    // Style scope: styles.css defines all --av-* tokens on .any-viewer-embed /
    // .any-viewer-view. Without this class the token layer (and the embed card
    // chrome) never applies to in-note embeds.
    span.classList.add("any-viewer-embed");

    // Size hints, mimicking Obsidian's image embeds:
    // - Obsidian parses `![[file|300]]` / `![[file|300x200]]` into width/height attributes
    // - for unknown-type embeds the alias may also land in `alt`
    // - extra syntax: `|x200` sets the height only
    let widthHint: number | undefined;
    let heightHint: number | undefined;
    const wAttr = parseInt(span.getAttribute("width") ?? "", 10);
    const hAttr = parseInt(span.getAttribute("height") ?? "", 10);
    if (Number.isFinite(wAttr) && wAttr > 0) widthHint = wAttr;
    if (Number.isFinite(hAttr) && hAttr > 0) heightHint = hAttr;
    const alias = (span.getAttribute("alt") ?? "").trim();
    const onlyHeight = /^x(\d+)$/.exec(alias);
    const std = /^(\d+)(?:x(\d+))?$/.exec(alias);
    if (onlyHeight) {
      heightHint ??= parseInt(onlyHeight[1], 10);
    } else if (std) {
      widthHint ??= parseInt(std[1], 10);
      if (std[2]) heightHint ??= parseInt(std[2], 10);
    }

    this.takeoverWhenReady(span, file, kind, widthHint, heightHint, frag);
  }

  /** Wait for Obsidian to finish resolving the embed, then take over. */
  private takeoverWhenReady(span: HTMLElement, file: TFile, kind: RenderKind, widthHint?: number, heightHint?: number, frag?: ParsedFragment): void {
    const resolved = () => span.classList.contains("is-loaded") || span.childElementCount > 0;
    if (resolved()) {
      this.takeover(span, file, kind, widthHint, heightHint, frag);
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      window.clearTimeout(timer);
      // Take over even when Obsidian has moved the span out of the document:
      // reading mode detaches/reattaches whole sections while scrolling, and
      // the span keeps its any-viewer-done flag — skipping here would leave
      // the chip permanent once the section comes back.
      this.takeover(span, file, kind, widthHint, heightHint, frag);
    };

    const observer = new MutationObserver(() => {
      if (resolved()) finish();
    });
    observer.observe(span, { childList: true, attributes: true, attributeFilter: ["class"] });

    const timer = window.setTimeout(finish, EmbedRenderer.TAKEOVER_TIMEOUT_MS);
  }

  /** Replace the span content with our rendering; re-apply if Obsidian rewrites it. */
  private takeover(span: HTMLElement, file: TFile, kind: RenderKind, widthHint?: number, heightHint?: number, frag?: ParsedFragment): void {
    const s = this.plugin.settings;

    const render = () => {
      span.empty();
      const frame = span.createDiv({ cls: "any-viewer-frame any-viewer-embed-frame" });
      if (widthHint) {
        // size the OUTER embed span so the card (border/background) shrinks too
        span.addClass("has-width");
        span.style.width = `${widthHint}px`;
      }
      void renderFileInto(this.plugin, frame, file, kind, {
        widthHint,
        heightHint,
        maxHeight: s.embedMaxHeight,
        showHeader: s.showEmbedHeader,
        allowScripts: s.htmlAllowScripts,
        frag,
      }).catch((err) => {
        console.error("[Any Viewer] embed render failed:", err);
        new Notice(t(s).noticeRenderFailed(file.name));
      });
    };

    render();
    this.live.set(span, render);

    // Clicking the embed content should NOT navigate (Obsidian's own handler
    // on the embed opens the linked file). Intercept in the capture phase,
    // but leave links / buttons / inputs interactive.
    span.addEventListener(
      "click",
      (ev: MouseEvent) => {
        const target = ev.target as HTMLElement | null;
        if (target && target.closest("a, button, .clickable-icon, input, textarea, select, [contenteditable]")) return;
        ev.stopPropagation();
        ev.preventDefault();
      },
      true
    );

    // Obsidian may rewrite the embed span later (e.g. on re-render); re-apply then.
    const guard = new MutationObserver(() => {
      if (!span.isConnected) {
        guard.disconnect();
        this.live.delete(span);
        return;
      }
      if (!span.querySelector(":scope > .any-viewer-frame")) render();
    });
    guard.observe(span, { childList: true });
  }
}
