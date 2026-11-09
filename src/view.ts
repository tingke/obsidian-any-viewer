import { FileView, TFile, WorkspaceLeaf } from "obsidian";
import AnyViewerPlugin from "./main";
import { renderFileInto } from "./embed";
import { RenderKind, kindForExt } from "./office";
import { openFileExternally } from "./util";

export const ANY_VIEW_TYPE = "any-viewer-file";

/** Full-pane view for office/html files opened from the file explorer. */
export class AnyViewerFileView extends FileView {
  private plugin: AnyViewerPlugin;
  private currentRender = 0;

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
    await this.render(file);
  }

  /** Re-render the current file (e.g. right after the UI language changes). */
  rerender(): void {
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
