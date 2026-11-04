# Any Viewer

一个 Obsidian 插件：在笔记中**插入并预览任意类型的文件** —— Word、Excel、PowerPoint、HTML、CSV 等，无法预览的格式显示文件卡片，一键调用系统默认应用打开。

## 功能

### 🧲 便捷插入（任意类型）
- **命令面板** → `Any Viewer: 插入本地文件（任意类型）`，或点击左侧 **回形针图标**
- **直接粘贴**：从桌面复制 Word/Excel/PPT/HTML 等文件，在笔记中 `Ctrl/Cmd+V`，自动存入库中并在光标处插入 `![[文件]]`
- **直接拖放**：把任意文件拖进编辑器，同样自动入库并插入嵌入
- 文件保存位置可配置：跟随 Obsidian 附件设置 / 笔记同目录 / 指定目录
- 重名文件自动追加序号（`报告 1.docx`），不覆盖

### 📄 笔记内预览
在笔记中写 `![[文件名.扩展名]]`，阅读视图直接渲染：

| 格式 | 渲染方式 |
|---|---|
| `.docx` | 高保真渲染（保留样式、分页），基于 [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) |
| `.xlsx` `.xls` `.csv` `.tsv` | 表格渲染 + 多工作表标签切换，基于 [SheetJS](https://sheetjs.com/) |
| `.pptx` | 幻灯片逐页渲染，基于 [pptx-preview](https://www.npmjs.com/package/pptx-preview) |
| `.html` `.htm` | 沙箱 iframe 内嵌渲染（可配置是否允许脚本） |
| 其他任意类型 | 文件卡片：类型图标 + 文件名 + 大小 |

- 支持 `![[文件.docx|600]]` 数字别名作为宽度提示
- 嵌入默认带标题栏（文件名 + "在标签页打开" + "用系统应用打开"），可关闭

### 🗂 标签页视图
在文件列表中点击 `.docx/.xlsx/.xls/.csv/.tsv/.pptx/.html/.htm` 文件，会用全高视图打开预览，支持"用系统应用打开"与"重新加载"。

### 🃏 未知类型兜底
`.zip`、`.exe`、`.psd`…… 任何 Obsidian 不认识的格式：
- 单击 → 系统默认应用打开
- Shift+单击 → 在系统文件管理器中显示（仅桌面端）

## 安装

### 手动安装
1. 下载 [main.js](releases) / `styles.css` / `manifest.json`（或从源码构建，见下）
2. 放入你的库：`你的库/.obsidian/plugins/any-viewer/`
3. 重启 Obsidian → 设置 → 第三方插件 → 启用 **Any Viewer**

### BRAT
BRAT → Add Plugin → 仓库地址填本仓库 Git URL。

## 从源码构建

```bash
npm install
npm run build     # 产物：main.js
```

## 已知限制

- `.doc` / `.ppt` 等老式二进制格式无法在笔记内预览（会显示文件卡片），双击仍可在系统应用中打开
- 实时预览（Live Preview）中嵌入以阅读模式同款渲染管线呈现，个别主题下可能需要切到阅读视图查看完整效果
- "用系统应用打开 / 在文件管理器中显示"仅桌面端可用
- `.pptx` 渲染为静态预览，动画与音视频不播放

## 致谢

- [docx-preview](https://github.com/VolodymyrBaydalka/docxjs)、[SheetJS](https://sheetjs.com/)、[pptx-preview](https://www.npmjs.com/package/pptx-preview) 提供渲染能力
- 调研期间参考了 Obsidian 社区的同类插件：[obsidian-file-link](https://github.com/marcjulianschwarz/obsidian-file-link)、[Styled MS Office Viewer](https://github.com/zoroaster1x/Styled-MS-Office-Viewer-for-Obsidian)、[obsidian-embed-html](https://github.com/mnaoumov/obsidian-embed-html) 等

## License

MIT
