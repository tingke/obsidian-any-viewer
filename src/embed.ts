import { App, MarkdownPostProcessorContext, Notice, TFile, getIcon } from "obsidian";
import AnyViewerPlugin from "./main";
import { buildFileCard } from "./card";
import { renderHtmlFrame } from "./html";
import { RenderKind, kindForExt, renderDocx, renderPptx, renderSheet } from "./office";
import { isNativeExt, openFileExternally } from "./util";

export interface RenderIntoOptions {
  /** Numeric alias from `![[file|600]]` used as a width hint. */
  widthHint?: number;
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
      iconWrap.appendChild(icon);
    }
    header.createDiv({ cls: "any-viewer-header-title", text: file.name });

    const openTabBtn = header.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "在标签页中打开" },
    });
    const tabIcon = getIcon("file-output");
    if (tabIcon) openTabBtn.appendChild(tabIcon);
    openTabBtn.addEventListener("click", () => {
      app.workspace.getLeaf("tab").openFile(file);
    });

    const extBtn = header.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": "用系统应用打开" },
    });
    const extIcon = getIcon("external-link");
    if (extIcon) extBtn.appendChild(extIcon);
    extBtn.addEventListener("click", () => openFileExternally(app, file));
  }

  const stage = host.createDiv({ cls: "any-viewer-stage" });
  if (opts.maxHeight) {
    stage.style.maxHeight = `${opts.maxHeight}px`;
    stage.addClass("is-scrollable");
  }
  if (opts.widthHint) stage.style.width = `${opts.widthHint}px`;

  if (kind === "card") {
    stage.appendChild(buildFileCard(app, file));
    return;
  }

  const loading = stage.createDiv({ cls: "any-viewer-loading", text: "正在加载…" });

  try {
    const data = await app.vault.readBinary(file);
    loading.remove();

    if (kind === "docx") {
      await renderDocx(stage, data);
    } else if (kind === "sheet") {
      renderSheet(stage, data);
    } else if (kind === "pptx") {
      const width = opts.widthHint ?? Math.max(480, Math.min(960, stage.clientWidth || host.clientWidth || 800));
      renderPptx(stage, data, width);
    } else if (kind === "html") {
      const url = (app.vault.adapter as any).getResourcePath(file);
      renderHtmlFrame(stage, url, { allowScripts: opts.allowScripts ?? true, height: opts.maxHeight });
    }
  } catch (err) {
    console.error("[Any Viewer] render failed:", err);
    loading.remove();
    stage.empty();
    const errBox = stage.createDiv({ cls: "any-viewer-error", text: `渲染失败：${String((err as Error)?.message ?? err)}` });
    errBox.appendChild(buildFileCard(app, file));
  }
}

/** Turns `![[file.docx]]`-style internal embeds of non-native file types into previews. */
export class EmbedRenderer {
  constructor(private plugin: AnyViewerPlugin) {}

  register(): void {
    this.plugin.registerMarkdownPostProcessor((el, ctx) => this.process(el, ctx));
  }

  private process(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const spans = el.querySelectorAll<HTMLElement>("span.internal-embed");
    for (const span of Array.from(spans)) {
      try {
        this.maybeRender(span, ctx);
      } catch (err) {
        console.error("[Any Viewer] embed processing failed:", err);
      }
    }
  }

  private maybeRender(span: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    if (span.classList.contains("any-viewer-done")) return;

    const src = span.getAttribute("src") ?? "";
    if (!src) return;

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
    span.classList.add("any-viewer-embed");

    // `![[file.docx|600]]` -> numeric alias acts as a width hint (like images)
    let widthHint: number | undefined;
    const alt = (span.getAttribute("alt") ?? "").trim();
    if (/^\d+$/.test(alt)) widthHint = parseInt(alt, 10);

    // Preserve the original embed behavior for the source markdown
    // (nothing to keep: we replace the placeholder content entirely).
    span.empty();

    renderFileInto(app, span, file, kind, {
      widthHint,
      maxHeight: s.embedMaxHeight,
      showHeader: s.showEmbedHeader,
      allowScripts: s.htmlAllowScripts,
    }).catch((err) => {
      console.error("[Any Viewer] embed render failed:", err);
      new Notice(`Any Viewer：${file.name} 渲染失败`);
    });
  }
}
