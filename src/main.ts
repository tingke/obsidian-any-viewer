import { App, Editor, MarkdownView, Modal, Notice, Plugin } from "obsidian";
import { EmbedRenderer } from "./embed";
import { InsertManager } from "./insert";
import { AnyViewerSettingTab } from "./settings";
import { DEFAULT_SETTINGS, AnyViewerSettings } from "./settings";
import { kindForExt } from "./renderers";
import { DOCX_EXTS, HTML_EXTS, PPTX_EXTS, SHEET_EXTS, resolveByBasename } from "./util";
import { ANY_VIEW_TYPE, AnyViewerFileView } from "./view";
import { t } from "./i18n";

export default class AnyViewerPlugin extends Plugin {
  settings: AnyViewerSettings = { ...DEFAULT_SETTINGS };
  private insertManager?: InsertManager;
  private embedRenderer?: EmbedRenderer;

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

    // Manual diagnosis of why an embed did (or did not) get taken over.
    this.addCommand({
      id: "diagnose-embeds",
      name: t(this.settings).cmdDiagnoseName,
      callback: () => this.diagnoseEmbeds(),
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
    const stored = (await this.loadData()) as Partial<AnyViewerSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...stored };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Dump every internal-embed element the active markdown view currently
   * renders, with everything the takeover pipeline keys on: tag, classes,
   * done-flag, src/text, format kind, and both resolution paths (metadata
   * index + basename fallback). Shown in a modal (also copied to the
   * clipboard) so the report survives any console filter — share it verbatim.
   */
  private diagnoseEmbeds(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const root = view ? view.contentEl : document.body;
    const sourcePath = view?.file?.path ?? "";
    const els = Array.from(root.querySelectorAll<HTMLElement>("[class*='internal-embed']"));
    const s = this.settings;
    const lines: string[] = [
      `note: ${sourcePath || "(no active markdown view — showing document)"}`,      `internal-embed elements: ${els.length}`,
      "",
    ];
    els.forEach((el, i) => {
      const raw = el.getAttribute("src") ?? el.getAttribute("data-src") ?? "(no src attr)";
      const pathPart = raw.split("#")[0].trim();
      const ext = (pathPart.includes(".") ? pathPart.split(".").pop() ?? "" : "").toLowerCase();
      const kind = kindForExt(ext, {
        docx: s.enableDocx,
        sheet: s.enableSheet,
        pptx: s.enablePptx,
        html: s.enableHtml,
        card: s.enableFallbackCard,
      });
      const indexed = pathPart ? this.app.metadataCache.getFirstLinkpathDest(pathPart, sourcePath) : null;
      const fallback = !indexed && pathPart ? resolveByBasename(this.app, pathPart, sourcePath) : null;
      lines.push(`${i + 1}. <${el.tagName.toLowerCase()}> class="${el.getAttribute("class") ?? ""}" done=${el.classList.contains("any-viewer-done")}`);
      lines.push(`   src="${raw}"`);
      lines.push(`   text="${(el.textContent ?? "").trim().slice(0, 40)}"`);
      lines.push(`   ext=${ext || "?"} kind=${kind ?? "null"} indexed=${indexed ? indexed.path : "null"} fallback=${fallback ? fallback.path : "null"}`);
      const stage = el.querySelector<HTMLElement>(":scope .any-viewer-stage");
      if (stage) {
        const kids = Array.from(stage.children)
          .map((c) => `${c.tagName.toLowerCase()}.${String(c.className).replace(/\s+/g, ".")}`)
          .join(" | ");
        lines.push(`   stage=[${kids || "EMPTY"}]`);
        lines.push(`   stageText="${stage.textContent?.trim().slice(0, 60) ?? ""}"`);
      } else {
        lines.push("   stage=none (takeover has not rendered yet)");
      }
    });
    new EmbedDiagnoseModal(this.app, lines.join("\n"), t(this.settings).diagnoseCopied).open();
  }
}

/** Read-only report modal for the embed diagnosis command. */
class EmbedDiagnoseModal extends Modal {
  constructor(
    app: App,
    private report: string,
    private copiedNotice: string
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.createEl("p", { text: this.copiedNotice });
    this.contentEl.createEl("pre", {
      text: this.report,
      attr: {
        style: "white-space:pre-wrap;user-select:text;background:var(--background-secondary);padding:12px;border-radius:8px;max-height:60vh;overflow:auto;font-size:12px",
      },
    });
    navigator.clipboard?.writeText(this.report).catch(() => {});
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
