# Obsidian Any Viewer

[![Release](https://img.shields.io/github/v/release/tingke/obsidian-any-viewer?include_prereleases)](https://github.com/tingke/obsidian-any-viewer/releases)
[![Build & Release](https://github.com/tingke/obsidian-any-viewer/actions/workflows/release.yml/badge.svg)](https://github.com/tingke/obsidian-any-viewer/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**English** | [中文](#中文说明)

An Obsidian plugin to **insert and preview any file type** inside your notes — Word, Excel, PowerPoint, HTML, CSV and more. Unsupported formats get a neat file card that opens with the system default app.

> Package name `obsidian-any-viewer`, plugin ID `any-viewer`.

## Supported file types

### Inline embeds + tab view

| Format | Rendering |
|---|---|
| `.docx` | High-fidelity rendering (styles, page breaks, headers/footers) via [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) |
| `.xlsx` `.xlsm` | **Real cell styling**: fills (incl. theme colors & tint), fonts, borders, alignment, merged cells, column widths, row heights, number formats via [exceljs](https://github.com/exceljs/exceljs) |
| `.xls` `.csv` `.tsv` | Table rendering with sheet tabs via [SheetJS](https://sheetjs.com/) |
| `.pptx` | Slide rendering (great for image-based decks) via [pptx-preview](https://www.npmjs.com/package/pptx-preview) |
| `.html` `.htm` | Sandboxed iframe (srcdoc with inlined stylesheets; script execution configurable) |

### File card fallback

Any other type Obsidian doesn't natively render (`.zip`, `.exe`, `.psd`, `.sketch`, …) becomes a file card: type icon + filename + size.

- Click → open with the system default app
- Shift+click → reveal in the system file manager (desktop only)

### Left untouched

Images, audio, video, PDF, Markdown and Canvas are rendered by Obsidian itself.

## Usage

### Easy insertion (any type)

- **Command palette** → `Any Viewer: 插入本地文件（任意类型）`, or click the **paperclip** ribbon icon
- **Paste** a copied file with `Ctrl/Cmd+V`, or **drag & drop** it into the editor
- Files are stored in the vault (location configurable) and an `![[file]]` embed is inserted at the cursor; name conflicts are auto-numbered

### Embeds & sizing

Write `![[filename.ext]]` in a note to preview it inline:

| Syntax | Effect |
|---|---|
| `![[report.xlsx]]` | Default size (full width, default height from settings) |
| `![[report.xlsx\|300]]` | Card sized to 300px wide; content keeps natural size and scrolls inside |
| `![[doc.docx\|x400]]` | Height only: 400px tall |
| `![[doc.docx\|300x400]]` | 300px wide + 400px tall |

Embeds have a header bar: **click the filename** or **double-click the content** to open the file in a tab; header buttons open a tab or the system app.

### Tab view

Clicking `.docx/.xlsx/.xls/.csv/.tsv/.pptx/.html/.htm` files in the explorer opens them in a full-height preview pane.

### Coexisting with other plugins

- Extensions claimed by other plugins are skipped automatically (with a notice); inline embeds keep working
- Turning a format **off** in settings makes this plugin completely hands-off that type (view registration *and* embeds — restart required), leaving it to plugins like styled-ms-office-viewer or CodeSpace

## Installation

### Manual

1. Download `main.js`, `styles.css`, `manifest.json` from the [latest release](https://github.com/tingke/obsidian-any-viewer/releases)
2. Put them in `<your vault>/.obsidian/plugins/any-viewer/`
3. Restart Obsidian → Settings → Community plugins → enable **Any Viewer**

### BRAT

BRAT → Add Plugin → paste this repository's Git URL.

## Building from source

```bash
npm install
npm run build     # produces main.js
```

## Known limitations

- Legacy binary formats (`.doc`, `.ppt`) can't be previewed inline (file card instead); they still open with the system app
- In HTML embeds, external `<script src>` may be blocked by Obsidian's CSP; inline scripts run fine
- "Open with system app / reveal in file manager" is desktop-only
- `.pptx` preview is static — animations and media don't play
- Compared to WASM-based viewers (e.g. styled-ms-office-viewer), docx/pptx fidelity is lower; both can coexist — tabs for them, inline embeds for Any Viewer

## Acknowledgements

- Rendering: [docx-preview](https://github.com/VolodymyrBaydalka/docxjs), [exceljs](https://github.com/exceljs/exceljs), [SheetJS](https://sheetjs.com/), [pptx-preview](https://www.npmjs.com/package/pptx-preview)
- HTML sandbox approach adapted from [mnaoumov/obsidian-embed-html](https://github.com/mnaoumov/obsidian-embed-html)
- Research phase referenced [obsidian-file-link](https://github.com/marcjulianschwarz/obsidian-file-link), [Styled MS Office Viewer](https://github.com/zoroaster1x/Styled-MS-Office-Viewer-for-Obsidian) and other community plugins

## License

[MIT](LICENSE)

---

<a id="中文说明"></a>

# 中文说明

一个 Obsidian 插件：在笔记中**插入并预览任意类型的文件** —— Word、Excel、PowerPoint、HTML、CSV 等，无法预览的格式显示文件卡片，一键调用系统默认应用打开。

> 项目名 `obsidian-any-viewer`，插件 ID `any-viewer`。

## 支持的文件类型

### 嵌入预览 + 标签页视图

| 格式 | 渲染方式 |
|---|---|
| `.docx` | 高保真渲染（保留样式、分页、页眉页脚），基于 [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) |
| `.xlsx` `.xlsm` | **真实单元格样式渲染**：填充色（含主题色/tint）、字体、边框、对齐、合并单元格、列宽行高、数字格式，基于 [exceljs](https://github.com/exceljs/exceljs) |
| `.xls` `.csv` `.tsv` | 表格渲染 + 多工作表标签切换，基于 [SheetJS](https://sheetjs.com/) |
| `.pptx` | 幻灯片渲染（图片型幻灯片还原度高），基于 [pptx-preview](https://www.npmjs.com/package/pptx-preview) |
| `.html` `.htm` | 沙箱 iframe 渲染（srcdoc + 内联样式表，可配置是否允许脚本） |

### 文件卡片兜底

除 Obsidian 原生支持的格式（图片 / 音视频 / PDF / md）外，**任意其他类型**（`.zip`、`.exe`、`.psd`、`.sketch`……）显示为文件卡片：类型图标 + 文件名 + 大小。

- 单击卡片 → 系统默认应用打开
- Shift+单击 → 在系统文件管理器中显示（仅桌面端）

### 不干预的格式

图片、音频、视频、PDF、Markdown、Canvas 由 Obsidian 原生渲染，插件不介入。

## 使用

### 便捷插入（任意类型）
- **命令面板** → `Any Viewer: 插入本地文件（任意类型）`，或点击左侧 **回形针图标**
- **直接粘贴**：复制文件后在笔记中 `Ctrl/Cmd+V`
- **直接拖放**：把文件拖进编辑器
- 文件自动存入库（位置可配置），光标处插入 `![[文件]]`；重名自动加序号

### 嵌入与宽高

在笔记中写 `![[文件名.扩展名]]` 即可内嵌预览：

| 语法 | 效果 |
|---|---|
| `![[报表.xlsx]]` | 默认尺寸（宽度随笔记，高度用设置默认值） |
| `![[报表.xlsx\|300]]` | 卡片宽度 300px，内容原始尺寸、内部滚动 |
| `![[文档.docx\|x400]]` | 只调高度：400px 高 |
| `![[文档.docx\|300x400]]` | 宽 300px + 高 400px |

嵌入自带标题栏：**单击文件名**或**双击内容**在标签页中打开；右上角按钮可在标签页打开 / 用系统应用打开。

### 标签页视图

点击库中的 `.docx/.xlsx/.xls/.csv/.tsv/.pptx/.html/.htm` 文件，用全高视图打开预览。

### 与其他插件的兼容

- 其他插件已注册的扩展名会自动让位（启动时提示），嵌入预览不受影响
- 设置里关闭某类格式 → 本插件完全不接管该类型（注册与嵌入都让出，**重启后生效**），可交给 styled-ms-office-viewer、CodeSpace 等专门插件

## 安装

### 手动安装
1. 从 [Latest Release](https://github.com/tingke/obsidian-any-viewer/releases) 下载 `main.js` / `styles.css` / `manifest.json`
2. 放入库目录：`你的库/.obsidian/plugins/any-viewer/`
3. 重启 Obsidian → 设置 → 第三方插件 → 启用 **Any Viewer**

### BRAT
BRAT → Add Plugin → 填写本仓库 Git URL。

## 从源码构建

```bash
npm install
npm run build     # 产物：main.js
```

## 已知限制

- `.doc` / `.ppt` 等老式二进制格式无法在笔记内预览（显示文件卡片），可通过卡片用系统应用打开
- HTML 嵌入中，外部 `<script src>` 可能被 Obsidian CSP 拦截；内联脚本正常执行
- "用系统应用打开 / 在文件管理器中显示"仅桌面端可用
- `.pptx` 为静态预览，不播放动画与音视频
- 与基于 WASM 引擎的标签页查看器（如 styled-ms-office-viewer）相比，docx/pptx 渲染保真度有限；两者可共存——标签页交给对方，笔记内嵌入由 Any Viewer 负责

## 致谢

- [docx-preview](https://github.com/VolodymyrBaydalka/docxjs)、[exceljs](https://github.com/exceljs/exceljs)、[SheetJS](https://sheetjs.com/)、[pptx-preview](https://www.npmjs.com/package/pptx-preview) 提供渲染能力
- HTML 沙箱渲染方案参考了 [mnaoumov/obsidian-embed-html](https://github.com/mnaoumov/obsidian-embed-html)
- 调研期间参考了 [obsidian-file-link](https://github.com/marcjulianschwarz/obsidian-file-link)、[Styled MS Office Viewer](https://github.com/zoroaster1x/Styled-MS-Office-Viewer-for-Obsidian) 等社区插件

## License

[MIT](LICENSE)
