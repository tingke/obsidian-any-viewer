import { Editor, Notice, Plugin } from "obsidian";
import { EmbedRenderer } from "./embed";
import { InsertManager } from "./insert";
import { AnyViewerSettingTab } from "./settings";
import { DEFAULT_SETTINGS, AnyViewerSettings } from "./settings";
import { VIEWABLE_EXTS } from "./util";
import { ANY_VIEW_TYPE, AnyViewerFileView } from "./view";

export default class AnyViewerPlugin extends Plugin {
  settings: AnyViewerSettings = { ...DEFAULT_SETTINGS };
  private insertManager?: InsertManager;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new AnyViewerSettingTab(this.app, this));

    // Dedicated tab view for supported office/html files.
    this.registerView(ANY_VIEW_TYPE, (leaf) => new AnyViewerFileView(leaf, this));
    this.registerExtensions(VIEWABLE_EXTS, ANY_VIEW_TYPE);

    // Inline `![[file.ext]]` embeds in notes.
    new EmbedRenderer(this).register();

    // Insert commands + paste/drop interception.
    this.insertManager = new InsertManager(this);
    this.insertManager.register();

    this.addRibbonIcon("paperclip", "Any Viewer：插入任意文件", () => {
      const editor = this.app.workspace.activeEditor as Editor | null;
      if (!editor) {
        new Notice("请先打开一篇笔记，再插入文件");
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
