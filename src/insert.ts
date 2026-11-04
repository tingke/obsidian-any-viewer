import { Editor, MarkdownFileInfo, Notice, TFile } from "obsidian";
import AnyViewerPlugin from "./main";
import { chooseFilePath, ensureFolder, linktextFor } from "./util";
import { t } from "./i18n";

/** Commands + paste/drop interception that copy files into the vault and insert embeds. */
export class InsertManager {
  constructor(private plugin: AnyViewerPlugin) {}

  register(): void {
    const p = this.plugin;

    p.addCommand({
      id: "insert-file",
      // Command names are registered once at load; keep a bilingual neutral name.
      name: "Insert local file (any type) 插入本地文件",
      editorCallback: (editor: Editor, ctx: MarkdownFileInfo) => {
        this.pickAndInsert(editor, ctx.file?.path ?? "");
      },
    });

    p.registerEvent(
      p.app.workspace.on("editor-paste", (evt: ClipboardEvent, editor: Editor) => this.onPaste(evt, editor))
    );

    p.registerEvent(
      p.app.workspace.on("editor-drop", (evt: DragEvent, editor: Editor) => this.onDrop(evt, editor))
    );
  }

  /** Open the system file picker and insert the chosen file(s). */
  pickAndInsert(editor: Editor, sourcePath: string): void {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.style.display = "none";
    document.body.appendChild(input);

    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      input.remove();
      if (!files.length) return;
      this.insertFiles(files, editor, sourcePath).catch((err) => {
        console.error("[Any Viewer] insert failed:", err);
        new Notice(t(this.plugin.settings).noticeInsertFailed(err instanceof Error ? err.message : String(err)));
      });
    });

    input.addEventListener("cancel", () => input.remove());
    input.click();
  }

  private onPaste(evt: ClipboardEvent, editor: Editor): boolean | void {
    if (!this.plugin.settings.interceptPaste) return;
    const files = Array.from(evt.clipboardData?.files ?? []);
    const targets = this.filterInterceptable(files);
    if (!targets.length) return;

    evt.preventDefault();
    this.insertFiles(targets, editor, this.activeSourcePath()).catch((err) => {
      console.error("[Any Viewer] paste insert failed:", err);
      new Notice(t(this.plugin.settings).noticePasteFailed(err instanceof Error ? err.message : String(err)));
    });
    return true;
  }

  private onDrop(evt: DragEvent, editor: Editor): boolean | void {
    if (!this.plugin.settings.interceptDrop) return;
    const files = Array.from(evt.dataTransfer?.files ?? []);
    const targets = this.filterInterceptable(files);
    if (!targets.length) return;

    evt.preventDefault();
    this.insertFiles(targets, editor, this.activeSourcePath()).catch((err) => {
      console.error("[Any Viewer] drop insert failed:", err);
      new Notice(t(this.plugin.settings).noticeDropFailed(err instanceof Error ? err.message : String(err)));
    });
    return true;
  }

  private filterInterceptable(files: File[]): File[] {
    if (this.plugin.settings.interceptImages) return files;
    // Leave images to Obsidian's native paste/drop handling.
    return files.filter((f) => !f.type.startsWith("image/"));
  }

  private activeSourcePath(): string {
    return this.plugin.app.workspace.getActiveFile()?.path ?? "";
  }

  /** Copy each file into the vault and insert `![[...]]` embeds at the cursor. */
  async insertFiles(files: File[], editor: Editor, sourcePath: string): Promise<void> {
    const app = this.plugin.app;
    const T = t(this.plugin.settings);
    const folder = await this.resolveFolder(sourcePath);
    if (folder) await ensureFolder(app.vault, folder);

    const lines: string[] = [];
    let ok = 0;

    for (const f of files) {
      try {
        const buf = await f.arrayBuffer();
        const path = await chooseFilePath(app.vault, folder, f.name);
        const created: TFile = await app.vault.createBinary(path, buf);
        lines.push(`![[${linktextFor(app, created, sourcePath)}]]`);
        ok++;
      } catch (err) {
        console.error("[Any Viewer] failed to save file:", f.name, err);
        new Notice(T.noticeSaveFailed(f.name));
      }
    }

    if (lines.length) {
      editor.replaceSelection(`${lines.join("\n")}\n`);
      new Notice(T.noticeInserted(ok));
    }
  }

  /** Folder where inserted files are stored, per settings. */
  private async resolveFolder(sourcePath: string): Promise<string> {
    const app = this.plugin.app;
    const s = this.plugin.settings;

    if (s.attachmentLocation === "custom") return s.customAttachmentPath;
    if (s.attachmentLocation === "current") return this.dirOf(sourcePath);

    // Follow Obsidian's own attachment folder setting.
    const cfg: string = (app.vault as any).getConfig?.("attachmentFolderPath") ?? "";
    const noteDir = this.dirOf(sourcePath);
    if (cfg === "./") return noteDir;
    if (cfg.startsWith("./")) return cfg.slice(2) ? `${noteDir ? noteDir + "/" : ""}${cfg.slice(2)}` : noteDir;
    if (!cfg || cfg === "/") return "";
    return cfg;
  }

  private dirOf(path: string): string {
    if (!path.includes("/")) return "";
    return path.split("/").slice(0, -1).join("/");
  }
}
