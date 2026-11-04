import { App, Notice, Platform, TFile, Vault, getIcon, normalizePath } from "obsidian";
import { t } from "./i18n";
import type AnyViewerPlugin from "./main";

/** Localized notice helpers that need app/settings context. */
export function notifyOpenFailed(plugin: AnyViewerPlugin, msg: string): void {
  new Notice(t(plugin.settings).noticeOpenFailed(msg));
}
export function notifyShellUnsupported(plugin: AnyViewerPlugin): void {
  new Notice(t(plugin.settings).noticeShellUnsupported);
}
export function notifyRevealUnsupported(plugin: AnyViewerPlugin): void {
  new Notice(t(plugin.settings).noticeRevealUnsupported);
}

/** Extensions handled by each renderer. */
export const DOCX_EXTS = ["docx"];
export const SHEET_EXTS = ["xlsx", "xls", "csv", "tsv"];
export const PPTX_EXTS = ["pptx"];
export const HTML_EXTS = ["html", "htm"];

/** All extensions that get a dedicated Any Viewer tab view. */
export const VIEWABLE_EXTS = [...DOCX_EXTS, ...SHEET_EXTS, ...PPTX_EXTS, ...HTML_EXTS];

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

/** Get the Electron shell bridge, defensively across Obsidian/Electron versions. */
export function getElectronShell(): { openPath?: (p: string) => any; showItemInFolder?: (p: string) => void } | null {
  if (Platform.isMobileApp || Platform.isMobile) return null;
  try {
    const req = (window as any).require;
    if (typeof req !== "function") return null;
    const electron = req("electron");
    if (!electron) return null;
    return electron.shell ?? electron.remote?.shell ?? null;
  } catch (e) {
    return null;
  }
}

/** Absolute filesystem path of a vault file (desktop only). */
export function vaultAbsolutePath(app: App, file: TFile): string {
  const adapter = (app.vault as any).adapter;
  if (adapter && typeof adapter.getFullPath === "function") {
    try {
      return adapter.getFullPath(file.path);
    } catch (e) {
      /* fall through */
    }
  }
  return file.path;
}

/** Open a vault file with the OS default application. */
export function openFileExternally(plugin: AnyViewerPlugin, file: TFile): void {
  const app = plugin.app;
  const shell: any = getElectronShell();
  const path = vaultAbsolutePath(app, file);
  if (shell && typeof shell.openPath === "function") {
    try {
      const res = shell.openPath(path);
      if (res && typeof res.then === "function") {
        res.then((errMsg: string) => {
          if (errMsg) notifyOpenFailed(plugin, errMsg);
        });
      }
      return;
    } catch (e) {
      console.error("[Any Viewer] openPath failed", e);
    }
  }
  notifyShellUnsupported(plugin);
}

/** Reveal a vault file in the system file manager. */
export function revealFileInSystem(plugin: AnyViewerPlugin, file: TFile): void {
  const shell: any = getElectronShell();
  if (shell && typeof shell.showItemInFolder === "function") {
    try {
      shell.showItemInFolder(vaultAbsolutePath(plugin.app, file));
      return;
    } catch (e) {
      console.error("[Any Viewer] showItemInFolder failed", e);
    }
  }
  notifyRevealUnsupported(plugin);
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
      } catch (e) {
        // may already exist due to a race
        if (!vault.getAbstractFileByPath(current)) throw e;
      }
    }
  }
}

/** Best linktext (basename if unique, else full path) for a file. */
export function linktextFor(app: App, file: TFile, sourcePath: string): string {
  const mc = app.metadataCache as any;
  if (typeof mc.fileToLinktext === "function") {
    try {
      return mc.fileToLinktext(file, sourcePath);
    } catch (e) {
      /* fall through */
    }
  }
  const dup = app.vault.getFiles().some((f) => f !== file && f.name === file.name);
  return dup ? file.path : file.name;
}
