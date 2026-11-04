import { AnyViewerSettings } from "./settings";

export type UiLanguage = "auto" | "zh" | "en";

type Dict = {
  // notices
  noticeNoActiveNote: string;
  noticeInserted: (n: number) => string;
  noticeSaveFailed: (name: string) => string;
  noticeInsertFailed: (msg: string) => string;
  noticePasteFailed: (msg: string) => string;
  noticeDropFailed: (msg: string) => string;
  noticeRenderFailed: (name: string) => string;
  noticeConflicts: (exts: string) => string;
  noticeOpenFailed: (msg: string) => string;
  noticeShellUnsupported: string;
  noticeRevealUnsupported: string;
  // embed ui
  loading: string;
  openInTab: string;
  openWithSystemApp: string;
  clickToOpenInTab: string;
  renderFailed: (msg: string) => string;
  emptyWorkbook: string;
  emptySheet: string;
  truncated: (rows: number, cols: number) => string;
  cardTooltip: (path: string) => string;
  cardClickHint: string;
  cardOpenLabel: string;
  // settings
  settingsInsert: string;
  settingsAttachmentLocation: string;
  settingsAttachmentLocationDesc: string;
  settingsLocObsidian: string;
  settingsLocCurrent: string;
  settingsLocCustom: string;
  settingsCustomFolder: string;
  settingsCustomFolderDesc: string;
  settingsInterceptPaste: string;
  settingsInterceptPasteDesc: string;
  settingsInterceptDrop: string;
  settingsInterceptDropDesc: string;
  settingsInterceptImages: string;
  settingsInterceptImagesDesc: string;
  settingsLanguage: string;
  settingsLanguageDesc: string;
  settingsFormats: string;
  settingsFormatDesc: string;
  settingsEnableDocx: string;
  settingsEnableSheet: string;
  settingsEnablePptx: string;
  settingsEnableHtml: string;
  settingsHtmlDesc: string;
  settingsFallbackCard: string;
  settingsFallbackCardDesc: string;
  settingsAppearance: string;
  settingsMaxHeight: string;
  settingsMaxHeightDesc: string;
  settingsShowHeader: string;
  settingsShowHeaderDesc: string;
  settingsAllowScripts: string;
  settingsAllowScriptsDesc: string;
};

const zh: Dict = {
  noticeNoActiveNote: "请先打开一篇笔记，再插入文件",
  noticeInserted: (n) => `Any Viewer：已插入 ${n} 个文件`,
  noticeSaveFailed: (name) => `Any Viewer：保存文件失败 - ${name}`,
  noticeInsertFailed: (msg) => `Any Viewer：插入失败 - ${msg}`,
  noticePasteFailed: (msg) => `Any Viewer：粘贴插入失败 - ${msg}`,
  noticeDropFailed: (msg) => `Any Viewer：拖放插入失败 - ${msg}`,
  noticeRenderFailed: (name) => `Any Viewer：${name} 渲染失败`,
  noticeConflicts: (exts) => `Any Viewer：${exts} 已被其他插件占用，点击这类文件将由对方插件打开；笔记内的嵌入预览与插入功能不受影响。`,
  noticeOpenFailed: (msg) => `Any Viewer：打开失败 - ${msg}`,
  noticeShellUnsupported: "Any Viewer：当前平台不支持调用系统应用打开文件",
  noticeRevealUnsupported: "Any Viewer：当前平台不支持在文件管理器中显示",
  loading: "正在加载…",
  openInTab: "在标签页中打开",
  openWithSystemApp: "用系统应用打开",
  clickToOpenInTab: "点击在标签页中打开",
  renderFailed: (msg) => `渲染失败：${msg}`,
  emptyWorkbook: "（空工作簿）",
  emptySheet: "（该工作表为空）",
  truncated: (rows, cols) => `表格过大，已截断显示前 ${rows} 行 × ${cols} 列（在标签页中打开可查看完整数据）`,
  cardTooltip: (path) => `${path}\n单击：用系统应用打开 · Shift+单击：在文件管理器中显示`,
  cardClickHint: "用系统应用打开",
  cardOpenLabel: "用系统应用打开",
  settingsInsert: "插入",
  settingsAttachmentLocation: "附件保存位置",
  settingsAttachmentLocationDesc: "通过命令、粘贴或拖拽插入的文件保存到哪里。",
  settingsLocObsidian: "跟随 Obsidian 附件设置",
  settingsLocCurrent: "当前笔记所在文件夹",
  settingsLocCustom: "指定文件夹",
  settingsCustomFolder: "指定附件文件夹",
  settingsCustomFolderDesc: "相对库根目录的路径，不存在时会自动创建。",
  settingsInterceptPaste: "接管粘贴",
  settingsInterceptPasteDesc: "粘贴非图片文件（Word、Excel、HTML 等）时，自动存入库中并在光标处插入嵌入。",
  settingsInterceptDrop: "接管拖放",
  settingsInterceptDropDesc: "从系统拖入非图片文件时，自动存入库中并插入嵌入（而非普通链接）。",
  settingsInterceptImages: "同时接管图片",
  settingsInterceptImagesDesc: "默认图片粘贴/拖放仍交给 Obsidian 原生处理，开启后一并接管。",
  settingsLanguage: "界面语言 / Language",
  settingsLanguageDesc: "设置页与提示信息的显示语言。Auto 跟随 Obsidian 界面语言。",
  settingsFormats: "预览格式",
  settingsFormatDesc: "关闭后本插件完全不接管该类型（不注册文件视图、不渲染嵌入），交由 Obsidian 或其他插件处理。修改后需重启 Obsidian 生效。",
  settingsEnableDocx: "Word 文档（.docx）",
  settingsEnableSheet: "电子表格（.xlsx / .xls / .csv / .tsv）",
  settingsEnablePptx: "演示文稿（.pptx）",
  settingsEnableHtml: "网页文件（.html / .htm）",
  settingsHtmlDesc: "以沙箱 iframe 方式在笔记内渲染。",
  settingsFallbackCard: "未知类型文件卡片",
  settingsFallbackCardDesc: "无法预览的格式显示带图标、大小的文件卡片，点击用系统默认应用打开，Shift+点击在文件管理器中显示。",
  settingsAppearance: "嵌入外观",
  settingsMaxHeight: "嵌入最大高度",
  settingsMaxHeightDesc: "笔记内嵌入内容超过此高度（像素）后出现滚动条。",
  settingsShowHeader: "显示嵌入标题栏",
  settingsShowHeaderDesc: "在嵌入内容上方显示文件名与快捷操作按钮。",
  settingsAllowScripts: "允许 HTML 运行脚本",
  settingsAllowScriptsDesc: "关闭后嵌入的 HTML 文件中的 JavaScript 不会执行（更安全，但交互页面会失效）。",
};

const en: Dict = {
  noticeNoActiveNote: "Open a note first, then insert files",
  noticeInserted: (n) => `Any Viewer: inserted ${n} file${n === 1 ? "" : "s"}`,
  noticeSaveFailed: (name) => `Any Viewer: failed to save ${name}`,
  noticeInsertFailed: (msg) => `Any Viewer: insert failed - ${msg}`,
  noticePasteFailed: (msg) => `Any Viewer: paste insert failed - ${msg}`,
  noticeDropFailed: (msg) => `Any Viewer: drop insert failed - ${msg}`,
  noticeRenderFailed: (name) => `Any Viewer: failed to render ${name}`,
  noticeConflicts: (exts) => `Any Viewer: ${exts} already registered by another plugin — opening such files falls back to that plugin. Inline embeds and insertion are unaffected.`,
  noticeOpenFailed: (msg) => `Any Viewer: failed to open - ${msg}`,
  noticeShellUnsupported: "Any Viewer: opening with the system app is not supported on this platform",
  noticeRevealUnsupported: "Any Viewer: revealing in the file manager is not supported on this platform",
  loading: "Loading…",
  openInTab: "Open in tab",
  openWithSystemApp: "Open with system app",
  clickToOpenInTab: "Click to open in a tab",
  renderFailed: (msg) => `Render failed: ${msg}`,
  emptyWorkbook: "(empty workbook)",
  emptySheet: "(empty sheet)",
  truncated: (rows, cols) => `Sheet too large — showing first ${rows} rows × ${cols} columns (open in a tab to see everything)`,
  cardTooltip: (path) => `${path}\nClick: open with system app · Shift+Click: reveal in file manager`,
  cardClickHint: "Open with system app",
  cardOpenLabel: "Open with system app",
  settingsInsert: "Insertion",
  settingsAttachmentLocation: "Attachment location",
  settingsAttachmentLocationDesc: "Where files inserted via command, paste or drag & drop are saved.",
  settingsLocObsidian: "Follow Obsidian's attachment setting",
  settingsLocCurrent: "Same folder as current note",
  settingsLocCustom: "Custom folder",
  settingsCustomFolder: "Custom attachment folder",
  settingsCustomFolderDesc: "Path relative to the vault root; missing folders are created automatically.",
  settingsInterceptPaste: "Intercept paste",
  settingsInterceptPasteDesc: "Non-image files (Word, Excel, HTML, …) pasted into the editor are saved into the vault and embedded at the cursor.",
  settingsInterceptDrop: "Intercept drop",
  settingsInterceptDropDesc: "Non-image files dragged from the system are saved into the vault and embedded (instead of a plain link).",
  settingsInterceptImages: "Include images",
  settingsInterceptImagesDesc: "By default images are left to Obsidian's native handling; enable to intercept them too.",
  settingsLanguage: "Language / 界面语言",
  settingsLanguageDesc: "UI language for the settings tab and notices. Auto follows Obsidian's interface language.",
  settingsFormats: "Preview formats",
  settingsFormatDesc: "When off, this plugin takes no part in that format at all (no file view, no embeds) — Obsidian or other plugins handle it. Restart required.",
  settingsEnableDocx: "Word documents (.docx)",
  settingsEnableSheet: "Spreadsheets (.xlsx / .xls / .csv / .tsv)",
  settingsEnablePptx: "Presentations (.pptx)",
  settingsEnableHtml: "Web pages (.html / .htm)",
  settingsHtmlDesc: "Rendered inline in a sandboxed iframe.",
  settingsFallbackCard: "File card for unknown types",
  settingsFallbackCardDesc: "Formats that can't be previewed show a card with icon and size; click opens the system app, Shift+click reveals in the file manager.",
  settingsAppearance: "Embed appearance",
  settingsMaxHeight: "Embed max height",
  settingsMaxHeightDesc: "Inline embeds scroll once taller than this (pixels).",
  settingsShowHeader: "Show embed header bar",
  settingsShowHeaderDesc: "Show the filename and quick actions above embed content.",
  settingsAllowScripts: "Allow scripts in HTML",
  settingsAllowScriptsDesc: "When off, JavaScript inside embedded HTML files won't run (safer, but interactive pages break).",
};

const DICTS: Record<"zh" | "en", Dict> = { zh, en };

export function resolveLang(setting: UiLanguage): "zh" | "en" {
  if (setting === "zh" || setting === "en") return setting;
  try {
    const obsidianLang = (window.localStorage.getItem("language") ?? "").toLowerCase();
    return obsidianLang.startsWith("zh") ? "zh" : "en";
  } catch (e) {
    return "en";
  }
}

/** Get the translated dictionary for current settings. */
export function t(settings: AnyViewerSettings): Dict {
  return DICTS[resolveLang(settings.language)];
}

export type { Dict };
