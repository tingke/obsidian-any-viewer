import { FileView, TFile, WorkspaceLeaf, getIcon } from "obsidian";
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

    this.addAction("external-link", "用系统应用打开", () => {
      if (this.file) openFileExternally(this.plugin.app, this.file);
    });
    this.addAction("refresh-cw", "重新加载", () => {
      if (this.file) this.render(this.file);
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

  private async render(file: TFile): Promise<void> {
    const token = ++this.currentRender;
    const app = this.plugin.app;
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

    // pptx needs a laid-out width; wait one frame before measuring
    if (kind === "pptx") {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (token !== this.currentRender) return;
    }

    await renderFileInto(app, frame, file, kind, {
      widthHint: kind === "pptx" ? Math.max(480, Math.min(1080, this.contentEl.clientWidth || 900)) : undefined,
      maxHeight: undefined,
      showHeader: true,
      allowScripts: s.htmlAllowScripts,
    });
    frame.querySelector(".any-viewer-stage")?.classList.add("fills");
  }
}
