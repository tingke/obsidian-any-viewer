import { App, Notice, Platform, TFile, Vault, FileSystemAdapter, getIcon, normalizePath } from "obsidian";
import type AnyViewerPlugin from "./main";
import type { ParsedFragment } from "./fragment";
import type { AnyViewerFileView } from "./view";
import { t } from "./i18n";

/** Extensions handled by each renderer. */
export const DOCX_EXTS = ["docx"];
export const SHEET_EXTS = ["xlsx", "xls", "csv", "tsv"];
export const PPTX_EXTS = ["pptx"];
export const HTML_EXTS = ["html", "htm"];

/** All extensions that get a dedicated Any Viewer tab view. */
export const VIEWABLE_EXTS = [...DOCX_EXTS, ...SHEET_EXTS, ...PPTX_EXTS, ...HTML_EXTS];

/**
 * View type id for Any Viewer tab views. Defined here so view.ts can
 * re-export it for the existing import sites.
 */
export const ANY_VIEW_TYPE = "any-viewer-file";

/** Extensions Obsidian renders natively (images / audio / video / pdf / notes). */
export const NATIVE_EXTS = new Set([
  "md", "canvas", "pdf",
  "png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "avif", "ico",
  "mp3", "wav", "ogg", "m4a", "flac", "aac", "opus",
  "mp4", "webm", "mov", "mkv", "avi", "m4v",
]);

export function isNativeExt(ext: string): boolean {
  return NATIVE_EXTS.has(ext.toLowerCase());
}

/**
 * Fallback link resolution for extensions Obsidian doesn't index (when
 * "Detect all file extensions" is off, metadataCache misses e.g. .zip/.docx
 * and getFirstLinkpathDest returns null). Matches by basename across the
 * whole vault instead — the vault adapter sees every file on disk regardless
 * of that setting. Prefers the source note's folder, then the shortest path.
 * Returns null when no (or genuinely no) matching file exists, so broken
 * links keep rendering Obsidian's own unresolved chip.
 */
export function resolveByBasename(app: App, linkpath: string, sourcePath: string): TFile | null {
  const wanted = linkpath.split("/").pop()?.trim().toLowerCase() ?? "";
  if (!wanted) return null;
  const lowered = linkpath.toLowerCase();
  const candidates = app.vault
    .getFiles()
    .filter((f) => f.name.toLowerCase() === wanted || f.path.toLowerCase() === lowered);
  if (!candidates.length) return null;
  const sourceDir = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/")) : "";
  const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
  return candidates.sort((a, b) => {
    const sameA = dirOf(a.path) === sourceDir ? 0 : 1;
    const sameB = dirOf(b.path) === sourceDir ? 0 : 1;
    return sameA - sameB || a.path.length - b.path.length;
  })[0];
}

const EXT_ICONS: Record<string, string> = {
  docx: "file-text", doc: "file-text", rtf: "file-text", odt: "file-text", txt: "file-text", log: "file-text",
  xlsx: "file-spreadsheet", xls: "file-spreadsheet", csv: "file-spreadsheet", tsv: "file-spreadsheet",
  pptx: "presentation", ppt: "presentation",
  html: "file-code", htm: "file-code", xml: "file-code", js: "file-code", ts: "file-code", py: "file-code", css: "file-code",
  zip: "file-archive", rar: "file-archive", "7z": "file-archive", tar: "file-archive", gz: "file-archive", bz2: "file-archive",
  exe: "package", msi: "package", dmg: "package", pkg: "package", apk: "package", app: "package", iso: "disc",
  json: "braces", md: "file-text",
  mp3: "file-audio", wav: "file-audio", flac: "file-audio",
  mp4: "file-video", mov: "file-video", avi: "file-video", mkv: "file-video",
  png: "file-image", jpg: "file-image", jpeg: "file-image", gif: "file-image", svg: "file-image", webp: "file-image",
  psd: "image", ai: "pen-tool", fig: "component", sketch: "pen-tool",
};

export function iconEl(ext: string): HTMLElement {
  const name = EXT_ICONS[ext.toLowerCase()] ?? "file";
  const icon = getIcon(name) ?? getIcon("file");
  if (icon) return icon as unknown as HTMLElement;
  return createDiv();
}

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

interface ElectronShellBridge {
  openPath(path: string): Promise<string> | string;
  showItemInFolder(path: string): void;
}

interface ElectronModule {
  shell?: ElectronShellBridge;
  remote?: { shell?: ElectronShellBridge };
}

/** Get the Electron shell bridge, defensively across Obsidian/Electron versions. */
export function getElectronShell(): ElectronShellBridge | null {
  if (Platform.isMobileApp || Platform.isMobile) return null;
  try {
    const req = (window as unknown as { require?: (module: string) => ElectronModule }).require;
    if (typeof req !== "function") return null;
    const electron = req("electron");
    if (!electron) return null;
    return electron.shell ?? electron.remote?.shell ?? null;
  } catch (err) {
    console.error("[Any Viewer] failed to access electron shell", err);
    return null;
  }
}

/** Absolute filesystem path of a vault file (desktop only). */
export function vaultAbsolutePath(app: App, file: TFile): string {
  if (app.vault.adapter instanceof FileSystemAdapter) {
    return app.vault.adapter.getFullPath(file.path);
  }
  return file.path;
}

/** Open a vault file with the OS default application. */
export function openFileExternally(plugin: AnyViewerPlugin, file: TFile): void {
  const app = plugin.app;
  const shell = getElectronShell();
  const path = vaultAbsolutePath(app, file);
  if (shell && typeof shell.openPath === "function") {
    try {
      const res = shell.openPath(path);
      if (typeof res === "string") {
        if (res) new Notice(t(plugin.settings).noticeOpenFailed(res));
        return;
      }
      void res.then((errMsg: string) => {
        if (errMsg) new Notice(t(plugin.settings).noticeOpenFailed(errMsg));
      });
      return;
    } catch (err) {
      console.error("[Any Viewer] openPath failed", err);
    }
  }
  new Notice(t(plugin.settings).noticeShellUnsupported);
}

/**
 * Open a file in a new tab in LOCATE mode: the tab renders the FULL file and
 * then scrolls/activates the fragment position (page N, sheet, range start,
 * element anchor). Two-pass by necessity — openFile renders first, then
 * applyFragment re-renders with the locate hint, because FileView offers no
 * way to hand state to a freshly created leaf view.
 */
export async function openFileWithFragment(app: App, file: TFile, frag?: ParsedFragment): Promise<void> {
  const leaf = app.workspace.getLeaf("tab");
  await leaf.openFile(file);
  if (!frag) return;
  const view = leaf.view;
  if (view && view.getViewType() === ANY_VIEW_TYPE) {
    (view as AnyViewerFileView).applyFragment(frag);
  }
}

/** Reveal a vault file in the system file manager. */
export function revealFileInSystem(plugin: AnyViewerPlugin, file: TFile): void {
  const shell = getElectronShell();
  if (shell && typeof shell.showItemInFolder === "function") {
    try {
      shell.showItemInFolder(vaultAbsolutePath(plugin.app, file));
      return;
    } catch (err) {
      console.error("[Any Viewer] showItemInFolder failed", err);
    }
  }
  new Notice(t(plugin.settings).noticeRevealUnsupported);
}

interface VaultWithAttachmentConfig {
  getConfig?(key: string): string;
}

function attachmentFolderConfig(app: App): string {
  const vault = app.vault as Vault & Partial<VaultWithAttachmentConfig>;
  return vault.getConfig?.("attachmentFolderPath") ?? "";
}

/** Pick a non-conflicting vault path for `filename` inside `folder` ('' = vault root). */
export async function chooseFilePath(vault: Vault, folder: string, filename: string): Promise<string> {
  const base = normalizePath(folder ? `${folder}/${filename}` : filename);
  if (!vault.getAbstractFileByPath(base)) return base;

  const dot = filename.lastIndexOf(".");
  const stem = dot === -1 ? filename : filename.slice(0, dot);
  const ext = dot === -1 ? "" : filename.slice(dot);
  for (let i = 1; i < 10000; i++) {
    const candidate = normalizePath(folder ? `${folder}/${stem} ${i}${ext}` : `${stem} ${i}${ext}`);
    if (!vault.getAbstractFileByPath(candidate)) return candidate;
  }
  return normalizePath(folder ? `${folder}/${Date.now()}-${filename}` : `${Date.now()}-${filename}`);
}

/** Create a folder (and parents) if missing. */
export async function ensureFolder(vault: Vault, folder: string): Promise<void> {
  const parts = folder.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!vault.getAbstractFileByPath(current)) {
      try {
        await vault.createFolder(current);
      } catch (err) {
        // may already exist due to a race
        if (!vault.getAbstractFileByPath(current)) throw err;
      }
    }
  }
}

/** Best linktext (basename if unique, else full path) for a file. */
export function linktextFor(app: App, file: TFile, sourcePath: string): string {
  return app.metadataCache.fileToLinktext(file, sourcePath);
}

/** Obsidian's attachment folder config values ('./' = note folder, '' = vault root). */
export function resolveAttachmentFolder(app: App, sourcePath: string, noteDir: string): string {
  const cfg = attachmentFolderConfig(app);
  if (cfg === "./") return noteDir;
  if (cfg.startsWith("./")) return cfg.slice(2) ? `${noteDir ? noteDir + "/" : ""}${cfg.slice(2)}` : noteDir;
  if (!cfg || cfg === "/") return "";
  return cfg;
}
