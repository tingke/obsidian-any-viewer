import { FileView, TFile, WorkspaceLeaf } from "obsidian";
import AnyViewerPlugin from "./main";
import { renderFileInto } from "./embed";
import type { ParsedFragment } from "./fragment";
import { RenderKind, kindForExt } from "./renderers";
import { ANY_VIEW_TYPE, openFileExternally } from "./util";

// View type id lives in util.ts (shared with openFileWithFragment there);
// re-exported for the existing import sites.
export { ANY_VIEW_TYPE };

/** Full-pane view for office/html files opened from the file explorer. */
export class AnyViewerFileView extends FileView {
  private plugin: AnyViewerPlugin;
  private currentRender = 0;
  /** Locate hint from an embed's "open in tab": full render, then jump here. */
  private pendingLocate?: ParsedFragment;

  constructor(leaf: WorkspaceLeaf, plugin: AnyViewerPlugin) {
    super(leaf);
    this.plugin = plugin;

    // addAction titles are set once per pane; use English/Chinese neutral short labels
    this.addAction("external-link", "Open with system app / 用系统应用打开", () => {
      if (this.file) openFileExternally(this.plugin, this.file);
    });
    this.addAction("refresh-cw", "Reload / 重新加载", () => {
      if (this.file) void this.render(this.file);
    });
  }

  getViewType(): string {
    return ANY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file ? this.file.basename : "Any Viewer";
  }

  getIcon(): string {
    return "paperclip";
  }

  async onLoadFile(file: TFile): Promise<void> {
    // A fresh openFile (explorer click, link click…) starts unlocated;
    // openFileWithFragment re-applies its hint right after via applyFragment().
    this.pendingLocate = undefined;
    await this.render(file);
  }

  /** Re-render the current file (e.g. right after the UI language changes). */
  rerender(): void {
    if (this.file) void this.render(this.file);
  }

  /**
   * Re-render with a locate hint (see openFileWithFragment): full file, then
   * scroll/activate the fragment position. Resets when a different file opens
   * (onLoadFile), so language switches and reloads keep the same position.
   */
  applyFragment(frag?: ParsedFragment): void {
    if (!frag) return;
    this.pendingLocate = frag;
    if (this.file) void this.render(this.file);
  }

  private async render(file: TFile): Promise<void> {
    const token = ++this.currentRender;
    const s = this.plugin.settings;

    const ext = (file.extension ?? "").toLowerCase();
    const kind: RenderKind =
      kindForExt(ext, {
        docx: s.enableDocx,
        sheet: s.enableSheet,
        pptx: s.enablePptx,
        html: s.enableHtml,
        card: s.enableFallbackCard,
      }) ?? "card";

    this.contentEl.empty();
    this.contentEl.addClass("any-viewer-view");

    const frame = this.contentEl.createDiv({ cls: "any-viewer-view-frame" });

    // pptx & html need a laid-out pane height; wait one frame before measuring
    if (kind === "pptx" || kind === "html") {
      await new Promise((r) => window.requestAnimationFrame(() => r(null)));
      if (token !== this.currentRender) return;
    }

    await renderFileInto(this.plugin, frame, file, kind, {
      locate: this.pendingLocate,
      pptxWidth: Math.max(480, Math.min(1080, this.contentEl.clientWidth || 900)),
      pptxHeight: Math.max(300, this.contentEl.clientHeight - 40 || 500),
      heightHint: kind === "html" ? Math.max(300, this.contentEl.clientHeight - 40 || 500) : undefined,
      maxHeight: undefined,
      showHeader: true,
      allowScripts: s.htmlAllowScripts,
    });
    // pptx keeps its own internal scrolling — "fills" would stack a second
    // scrollbar on top of the viewer's own one in the tab view.
    const stage = frame.querySelector(".any-viewer-stage");
    if (stage && !stage.classList.contains("no-scroll")) stage.classList.add("fills");
  }
}
