import { App, MarkdownPostProcessorContext, Notice, TFile, getIcon } from "obsidian";
import AnyViewerPlugin from "./main";
import { buildFileCard } from "./card";
import { renderHtmlFrame } from "./html";
import { RenderKind, kindForExt, renderDocx, renderPptx } from "./office";
import { renderSheet } from "./sheet";
import { isNativeExt, openFileExternally } from "./util";

export interface RenderIntoOptions {
  /** Numeric alias from `![[file|600]]` used as an embed height hint (px). */
  heightHint?: number;
  /** Slide width for pptx rendering (px). */
  pptxWidth?: number;
  /** Max height in px (embeds only; views fill the pane). */
  maxHeight?: number;
  /** Show filename header bar with actions. */
  showHeader?: boolean;
  /** Allow JavaScript inside embedded HTML files. */
  allowScripts?: boolean;
}

/** Render `file` (of the given kind) into `host`. Shared by embeds and the tab view. */
export async function renderFileInto(app: App, host: HTMLElement, file: TFile, kind: RenderKind, opts: RenderIntoOptions = {}): Promise<void> {
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
    title.setAttribute("aria-label", "点击在标签页中打开");
    title.addEventListener("click", () => {
      app.workspace.getLeaf("tab").openFile(file);
    });

    const openTabBtn = header.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "在标签页中打开" },
    });
    const tabIcon = getIcon("file-output");
    if (tabIcon) openTabBtn.appendChild(tabIcon as unknown as HTMLElement);
    openTabBtn.addEventListener("click", () => {
      app.workspace.getLeaf("tab").openFile(file);
    });

    const extBtn = header.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "用系统应用打开" },
    });
    const extIcon = getIcon("external-link");
    if (extIcon) extBtn.appendChild(extIcon as unknown as HTMLElement);
    extBtn.addEventListener("click", () => openFileExternally(app, file));
  }

  const stage = host.createDiv({ cls: "any-viewer-stage" });
  // Numeric alias / settings control the embed height; width stays fluid with horizontal scroll.
  const effectiveHeight = opts.heightHint ?? opts.maxHeight;
  if (effectiveHeight) {
    stage.style.maxHeight = `${effectiveHeight}px`;
    stage.addClass("is-scrollable");
  }

  if (kind === "card") {
    stage.appendChild(buildFileCard(app, file));
    return;
  }

  const loading = stage.createDiv({ cls: "any-viewer-loading", text: "正在加载…" });
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
      await renderSheet(stage, file, data);
    } else if (kind === "pptx") {
      const width = opts.pptxWidth ?? Math.max(480, Math.min(960, stage.clientWidth || host.clientWidth || 800));
      renderPptx(stage, data, width);
    } else if (kind === "html") {
      const url = (app.vault.adapter as any).getResourcePath(file);
      renderHtmlFrame(stage, url, { allowScripts: opts.allowScripts ?? true, height: effectiveHeight });
    }
  } catch (err) {
    console.error("[Any Viewer] render failed:", err);
    loading.remove();
    stage.empty();
    const errBox = stage.createDiv({ cls: "any-viewer-error", text: `渲染失败：${String((err as Error)?.message ?? err)}` });
    errBox.appendChild(buildFileCard(app, file));
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

    // `![[file.docx|600]]` -> numeric alias acts as a width hint (like images)
    let heightHint: number | undefined;
    const alias = (span.getAttribute("alt") ?? "").trim();
    if (/^\d+$/.test(alias)) heightHint = parseInt(alias, 10);

    this.takeoverWhenReady(span, file, kind, heightHint);
  }

  /** Wait for Obsidian to finish resolving the embed, then take over. */
  private takeoverWhenReady(span: HTMLElement, file: TFile, kind: RenderKind, heightHint?: number): void {
    const resolved = () => span.classList.contains("is-loaded") || span.childElementCount > 0;
    if (resolved()) {
      this.takeover(span, file, kind, heightHint);
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      observer.disconnect();
      clearTimeout(timer);
      if (span.isConnected) this.takeover(span, file, kind, heightHint);
    };

    const observer = new MutationObserver(() => {
      if (resolved()) finish();
    });
    observer.observe(span, { childList: true, attributes: true, attributeFilter: ["class"] });

    const timer = setTimeout(finish, EmbedRenderer.TAKEOVER_TIMEOUT_MS);
  }

  /** Replace the span content with our rendering; re-apply if Obsidian rewrites it. */
  private takeover(span: HTMLElement, file: TFile, kind: RenderKind, heightHint?: number): void {
    const app = this.plugin.app;
    const s = this.plugin.settings;

    const render = () => {
      span.empty();
      const frame = span.createDiv({ cls: "any-viewer-frame any-viewer-embed-frame" });
      renderFileInto(app, frame, file, kind, {
        heightHint,
        maxHeight: s.embedMaxHeight,
        showHeader: s.showEmbedHeader,
        allowScripts: s.htmlAllowScripts,
      }).catch((err) => {
        console.error("[Any Viewer] embed render failed:", err);
        new Notice(`Any Viewer：${file.name} 渲染失败`);
      });
    };

    render();

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
