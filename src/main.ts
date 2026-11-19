import { Editor, Notice, Plugin } from "obsidian";
import { EmbedRenderer } from "./embed";
import { InsertManager } from "./insert";
import { notePosition, ReadingPositionMap, sanitizePositions } from "./positions";
import { AnyViewerSettingTab } from "./settings";
import { DEFAULT_SETTINGS, AnyViewerSettings } from "./settings";
import { DOCX_EXTS, HTML_EXTS, PPTX_EXTS, SHEET_EXTS } from "./util";
import { ANY_VIEW_TYPE, AnyViewerFileView } from "./view";
import { t } from "./i18n";

/** data.json envelope version. v1 (legacy) = the settings object itself. */
const DATA_FORMAT = 2;

export default class AnyViewerPlugin extends Plugin {
  settings: AnyViewerSettings = { ...DEFAULT_SETTINGS };
  /** Tab-channel reading positions, persisted inside data.json (see positions.ts). */
  readingPositions: ReadingPositionMap = new Map();
  private insertManager?: InsertManager;
  private embedRenderer?: EmbedRenderer;
  private positionPersistTimer?: number;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new AnyViewerSettingTab(this.app, this));

    // Style Settings integration (v0.6 style-settings package): the @settings
    // block lives in styles.css and Style Settings picks it up on this trigger.
    // No-op when Style Settings is not installed.
    this.app.workspace.trigger("parse-style-settings");

    // In-document search, registered as a real command so it appears under
    // Settings → Hotkeys and users can rebind it. NO default hotkey — the
    // official review forbids shipping one; Mod+F is handled by a window
    // listener in AnyViewerFileView instead, so the default muscle memory
    // still works while the binding stays adjustable.
    this.addCommand({
      id: "search-in-document-view",
      name: "在文档中搜索",
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(AnyViewerFileView);
        if (!view || !view.hasSearch()) return false;
        if (!checking) view.openSearch();
        return true;
      },
    });

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
    this.embedRenderer = new EmbedRenderer(this);
    this.embedRenderer.register();

    // Insert commands + paste/drop interception.
    this.insertManager = new InsertManager(this);
    this.insertManager.register();

    this.addRibbonIcon("paperclip", "Any viewer — insert files / 插入任意文件", () => {
      const editor = this.app.workspace.activeEditor as Editor | null;
      if (!editor) {
        new Notice(t(this.settings).noticeNoActiveNote);
        return;
      }
      this.insertManager?.pickAndInsert(editor, this.app.workspace.getActiveFile()?.path ?? "");
    });
  }

  // NOTE: no detachLeavesOfType here — Obsidian guidance is to leave leaves
  // where the user placed them; they are re-adopted when the plugin reloads.

  /**
   * Re-render every surface that bakes translated strings at render time.
   * Called right after the UI language setting changes so switching is
   * instant everywhere — no restart, no settings-modal reload.
   */
  refreshLocalizedUi(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(ANY_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof AnyViewerFileView) view.rerender();
    }
    this.embedRenderer?.refreshAll();
  }

  async loadSettings(): Promise<void> {
    const raw = (await this.loadData()) as Record<string, unknown> | null;
    if (raw && raw.format === DATA_FORMAT) {
      // v2 envelope: settings and reading positions live side by side.
      this.settings = { ...DEFAULT_SETTINGS, ...((raw.settings as Partial<AnyViewerSettings> | undefined) ?? {}) };
      this.readingPositions = sanitizePositions(raw.readingPositions);
    } else {
      // v1 (or empty): the whole file is the settings object — nothing to migrate.
      this.settings = { ...DEFAULT_SETTINGS, ...((raw as Partial<AnyViewerSettings> | null) ?? {}) };
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.exportData());
  }

  /** Everything persisted in data.json: settings + tab reading positions. */
  private exportData(): Record<string, unknown> {
    return {
      format: DATA_FORMAT,
      settings: this.settings,
      readingPositions: Object.fromEntries(this.readingPositions),
    };
  }

  /** Record a tab view reading position; persists on a short debounce. */
  noteReadingPosition(path: string, pos: { scroll: number; sheet?: string }): void {
    notePosition(this.readingPositions, path, pos);
    window.clearTimeout(this.positionPersistTimer);
    this.positionPersistTimer = window.setTimeout(() => void this.persistReadingPositions(), 3000);
  }

  /** Flush pending position writes (view close, plugin unload). */
  async persistReadingPositions(): Promise<void> {
    window.clearTimeout(this.positionPersistTimer);
    await this.saveData(this.exportData());
  }

  onunload(): void {
    // Fire-and-forget: saveData during unload still completes reliably, but
    // Plugin.onunload is sync — don't hand it a Promise.
    void this.persistReadingPositions();
  }

}
