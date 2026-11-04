# Obsidian Any Viewer

[![Release](https://img.shields.io/github/v/release/tingke/obsidian-any-viewer?include_prereleases)](https://github.com/tingke/obsidian-any-viewer/releases)
[![Build & Release](https://github.com/tingke/obsidian-any-viewer/actions/workflows/release.yml/badge.svg)](https://github.com/tingke/obsidian-any-viewer/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**English** | [中文](README.zh.md)

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
