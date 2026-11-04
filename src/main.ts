import { Editor, Notice, Plugin } from "obsidian";
import { EmbedRenderer } from "./embed";
import { InsertManager } from "./insert";
import { AnyViewerSettingTab } from "./settings";
import { DEFAULT_SETTINGS, AnyViewerSettings } from "./settings";
import { DOCX_EXTS, HTML_EXTS, PPTX_EXTS, SHEET_EXTS } from "./util";
import { ANY_VIEW_TYPE, AnyViewerFileView } from "./view";
import { t } from "./i18n";

export default class AnyViewerPlugin extends Plugin {
  settings: AnyViewerSettings = { ...DEFAULT_SETTINGS };
  private insertManager?: InsertManager;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new AnyViewerSettingTab(this.app, this));

    // Dedicated tab view for supported office/html files.
    // Register one extension at a time: another plugin may already own some
    // of them (e.g. styled-ms-office-viewer claims docx), and Obsidian throws
    // on duplicates — we skip those instead of failing the whole plugin.
    // Only extensions whose format toggle is ON are claimed; disabled formats
    // stay with other plugins (needs an app restart to take effect).
    this.registerView(ANY_VIEW_TYPE, (leaf) => new AnyViewerFileView(leaf, this));
    const s = this.settings;
    const exts = [
      ...(s.enableDocx ? DOCX_EXTS : []),
      ...(s.enableSheet ? SHEET_EXTS : []),
      ...(s.enablePptx ? PPTX_EXTS : []),
      ...(s.enableHtml ? HTML_EXTS : []),
    ];
    const conflicts: string[] = [];
    for (const ext of exts) {
      try {
        this.registerExtensions([ext], ANY_VIEW_TYPE);
      } catch (err) {
        conflicts.push(ext);
        console.warn(`[Any Viewer] "${ext}" already registered by another plugin, skipping`, err);
      }
    }
    if (conflicts.length) {
      new Notice(t(this.settings).noticeConflicts(conflicts.join(", ")), 8000);
    }

    // Inline `![[file.ext]]` embeds in notes.
    new EmbedRenderer(this).register();

    // Insert commands + paste/drop interception.
    this.insertManager = new InsertManager(this);
    this.insertManager.register();

    this.addRibbonIcon("paperclip", "Any Viewer — insert files / 插入任意文件", () => {
      const editor = this.app.workspace.activeEditor as Editor | null;
      if (!editor) {
        new Notice(t(this.settings).noticeNoActiveNote);
        return;
      }
      this.insertManager?.pickAndInsert(editor, this.app.workspace.getActiveFile()?.path ?? "");
    });
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(ANY_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
