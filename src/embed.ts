import { MarkdownPostProcessorContext, Notice, TFile, getIcon } from "obsidian";
import AnyViewerPlugin from "./main";
import { buildFileCard } from "./card";
import { renderHtmlFrame } from "./html";
import { RenderKind, kindForExt, renderDocx, renderPptx } from "./office";
import { renderSheet } from "./sheet";
import { isNativeExt, openFileExternally } from "./util";
import { t } from "./i18n";

export interface RenderIntoOptions {
  /** Display width hint in px (from `![[file|300]]` / width attr): the card is sized to it. */
  widthHint?: number;
  /** Display height hint in px (from `![[file|300x200]]` / height attr): clamps embed height. */
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
}

/** Render `file` (of the given kind) into `host`. Shared by embeds and the tab view. */
export async function renderFileInto(plugin: AnyViewerPlugin, host: HTMLElement, file: TFile, kind: RenderKind, opts: RenderIntoOptions = {}): Promise<void> {
  const app = plugin.app;
  const T = t(plugin.settings);
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
    title.addClass("is-clickable");
    title.setAttribute("aria-label", T.clickToOpenInTab);
    title.addEventListener("click", () => {
      app.workspace.getLeaf("tab").openFile(file);
    });

    const openTabBtn = header.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": T.openInTab },
    });
    const tabIcon = getIcon("file-output");
    if (tabIcon) openTabBtn.appendChild(tabIcon as unknown as HTMLElement);
    openTabBtn.addEventListener("click", () => {
      app.workspace.getLeaf("tab").openFile(file);
    });

    const extBtn = header.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": T.openWithSystemApp },
    });
    const extIcon = getIcon("external-link");
    if (extIcon) extBtn.appendChild(extIcon as unknown as HTMLElement);
    extBtn.addEventListener("click", () => openFileExternally(plugin, file));
  }

  const stage = host.createDiv({ cls: "any-viewer-stage" });
  // The card width is applied to the outer embed span (has-width); content keeps
  // its natural size and scrolls inside. pptx & html manage their own scrolling.
  const effectiveHeight = opts.heightHint ?? opts.maxHeight;
  const selfScrolling = kind === "pptx" || kind === "html";
  if (!selfScrolling && (effectiveHeight || opts.widthHint)) {
    if (effectiveHeight) stage.style.maxHeight = `${effectiveHeight}px`;
    stage.addClass("is-scrollable");
  }

  if (kind === "card") {
    stage.appendChild(buildFileCard(plugin, file));
    return;
  }

  const loading = stage.createDiv({ cls: "any-viewer-loading", text: T.loading });
  // Double-click anywhere on the embed content opens the file in a tab.
  stage.addEventListener("dblclick", () => {
    app.workspace.getLeaf("tab").openFile(file);
  });

  try {
    const data = await app.vault.readBinary(file);
    loading.remove();

    if (kind === "docx") {
      await renderDocx(stage, data);
    } else if (kind === "sheet") {
      await renderSheet(stage, file, data, T);
    } else if (kind === "pptx") {
      stage.addClass("no-scroll"); // the pptx viewer scrolls internally
      const width = opts.pptxWidth ?? Math.max(480, Math.min(960, stage.clientWidth || host.clientWidth || 800));
      const height = opts.pptxHeight ?? Math.round((width * 9) / 16);
      renderPptx(stage, data, width, height);
    } else if (kind === "html") {
      let resourceUrl: string | undefined;
      const vault = app.vault as any;
      try {
        if (typeof vault.getResourcePath === "function") resourceUrl = vault.getResourcePath(file);
        else if (typeof vault.adapter?.getResourcePath === "function") resourceUrl = vault.adapter.getResourcePath(file.path);
      } catch (e) {
        resourceUrl = undefined;
      }
      await renderHtmlFrame(stage, data, {
        allowScripts: opts.allowScripts ?? true,
        height: opts.heightHint,
        maxHeight: opts.maxHeight,
        resourceUrl,
      });
    }
  } catch (err) {
    console.error("[Any Viewer] render failed:", err);
    loading.remove();
    stage.empty();
    const errBox = stage.createDiv({ cls: "any-viewer-error", text: T.renderFailed(String((err as Error)?.message ?? err)) });
    errBox.appendChild(buildFileCard(plugin, file));
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

  constructor(private plugin: AnyViewerPlugin) {}

  register(): void {
    this.plugin.registerMarkdownPostProcessor((el, ctx) => this.process(el, ctx));
  }

  private process(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const spans = el.querySelectorAll<HTMLElement>("span.internal-embed");
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

    let src = (span.getAttribute("src") ?? "").trim();
    if (!src) return;
    src = src.split("#")[0].trim();
    if (!src) return;
    try {
      src = decodeURIComponent(src);
    } catch (e) {
      /* keep raw */
    }

    const app = this.plugin.app;
    const file = app.metadataCache.getFirstLinkpathDest(src, ctx.sourcePath);
    if (!file || !(file instanceof TFile)) return;

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
    if (!kind) return;

    span.classList.add("any-viewer-done");

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

    this.takeoverWhenReady(span, file, kind, widthHint, heightHint);
  }

  /** Wait for Obsidian to finish resolving the embed, then take over. */
  private takeoverWhenReady(span: HTMLElement, file: TFile, kind: RenderKind, widthHint?: number, heightHint?: number): void {
    const resolved = () => span.classList.contains("is-loaded") || span.childElementCount > 0;
    if (resolved()) {
      this.takeover(span, file, kind, widthHint, heightHint);
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      clearTimeout(timer);
      if (span.isConnected) this.takeover(span, file, kind, widthHint, heightHint);
    };

    const observer = new MutationObserver(() => {
      if (resolved()) finish();
    });
    observer.observe(span, { childList: true, attributes: true, attributeFilter: ["class"] });

    const timer = setTimeout(finish, EmbedRenderer.TAKEOVER_TIMEOUT_MS);
  }

  /** Replace the span content with our rendering; re-apply if Obsidian rewrites it. */
  private takeover(span: HTMLElement, file: TFile, kind: RenderKind, widthHint?: number, heightHint?: number): void {
    const s = this.plugin.settings;

    const render = () => {
      span.empty();
      const frame = span.createDiv({ cls: "any-viewer-frame any-viewer-embed-frame" });
      if (widthHint) {
        // size the OUTER embed span so the card (border/background) shrinks too
        span.addClass("has-width");
        span.style.width = `${widthHint}px`;
      }
      renderFileInto(this.plugin, frame, file, kind, {
        widthHint,
        heightHint,
        maxHeight: s.embedMaxHeight,
        showHeader: s.showEmbedHeader,
        allowScripts: s.htmlAllowScripts,
      }).catch((err) => {
        console.error("[Any Viewer] embed render failed:", err);
        new Notice(t(s).noticeRenderFailed(file.name));
      });
    };

    render();

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
        return;
      }
      if (!span.querySelector(":scope > .any-viewer-frame")) render();
    });
    guard.observe(span, { childList: true });
  }
}
