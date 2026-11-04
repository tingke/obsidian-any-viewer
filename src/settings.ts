import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";
import AnyViewerPlugin from "./main";

export type AttachmentLocation = "obsidian" | "current" | "custom";

export interface AnyViewerSettings {
  /** Where pasted/dropped/inserted files are saved. */
  attachmentLocation: AttachmentLocation;
  customAttachmentPath: string;
  /** Intercept non-image file pastes into the editor. */
  interceptPaste: boolean;
  /** Intercept external file drops into the editor. */
  interceptDrop: boolean;
  /** Also intercept images (otherwise leave them to Obsidian). */
  interceptImages: boolean;

  enableDocx: boolean;
  enableSheet: boolean;
  enablePptx: boolean;
  enableHtml: boolean;
  /** Show a file card for any other extension. */
  enableFallbackCard: boolean;

  /** Max height (px) of inline embeds before they scroll. */
  embedMaxHeight: number;
  /** Show a filename header bar above embeds. */
  showEmbedHeader: boolean;
  /** Allow scripts inside sandboxed HTML files. */
  htmlAllowScripts: boolean;
}

export const DEFAULT_SETTINGS: AnyViewerSettings = {
  attachmentLocation: "obsidian",
  customAttachmentPath: "attachments",
  interceptPaste: true,
  interceptDrop: true,
  interceptImages: false,
  enableDocx: true,
  enableSheet: true,
  enablePptx: true,
  enableHtml: true,
  enableFallbackCard: true,
  embedMaxHeight: 420,
  showEmbedHeader: true,
  htmlAllowScripts: true,
};

export class AnyViewerSettingTab extends PluginSettingTab {
  plugin: AnyViewerPlugin;

  constructor(app: App, plugin: AnyViewerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("插入").setHeading();

    new Setting(containerEl)
      .setName("附件保存位置")
      .setDesc("通过命令、粘贴或拖拽插入的文件保存到哪里。")
      .addDropdown((d) =>
        d
          .addOption("obsidian", "跟随 Obsidian 附件设置")
          .addOption("current", "当前笔记所在文件夹")
          .addOption("custom", "指定文件夹")
          .setValue(this.plugin.settings.attachmentLocation)
          .onChange(async (v) => {
            this.plugin.settings.attachmentLocation = v as AttachmentLocation;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (this.plugin.settings.attachmentLocation === "custom") {
      new Setting(containerEl)
        .setName("指定附件文件夹")
        .setDesc("相对库根目录的路径，不存在时会自动创建。")
        .addText((t) =>
          t
            .setPlaceholder("attachments")
            .setValue(this.plugin.settings.customAttachmentPath)
            .onChange(async (v) => {
              this.plugin.settings.customAttachmentPath = normalizePath(v.trim() || "attachments");
              await this.plugin.saveSettings();
            })
        );
    }

    new Setting(containerEl)
      .setName("接管粘贴")
      .setDesc("粘贴非图片文件（Word、Excel、HTML 等）时，自动存入库中并在光标处插入嵌入。")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.interceptPaste).onChange(async (v) => {
          this.plugin.settings.interceptPaste = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("接管拖放")
      .setDesc("从系统拖入非图片文件时，自动存入库中并插入嵌入（而非普通链接）。")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.interceptDrop).onChange(async (v) => {
          this.plugin.settings.interceptDrop = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("同时接管图片")
      .setDesc("默认图片粘贴/拖放仍交给 Obsidian 原生处理，开启后一并接管。")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.interceptImages).onChange(async (v) => {
          this.plugin.settings.interceptImages = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("预览格式").setHeading();

    new Setting(containerEl)
      .setName("Word 文档（.docx）")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableDocx).onChange(async (v) => {
          this.plugin.settings.enableDocx = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("电子表格（.xlsx / .xls / .csv / .tsv）")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableSheet).onChange(async (v) => {
          this.plugin.settings.enableSheet = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("演示文稿（.pptx）")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enablePptx).onChange(async (v) => {
          this.plugin.settings.enablePptx = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("网页文件（.html / .htm）")
      .setDesc("以沙箱 iframe 方式在笔记内渲染。")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableHtml).onChange(async (v) => {
          this.plugin.settings.enableHtml = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("未知类型文件卡片")
      .setDesc("无法预览的格式显示带图标、大小的文件卡片，点击用系统默认应用打开，Shift+点击在文件管理器中显示。")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.enableFallbackCard).onChange(async (v) => {
          this.plugin.settings.enableFallbackCard = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("嵌入外观").setHeading();

    new Setting(containerEl)
      .setName("嵌入最大高度")
      .setDesc("笔记内嵌入内容超过此高度（像素）后出现滚动条。")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.embedMaxHeight)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!Number.isNaN(n) && n >= 100 && n <= 10000) {
            this.plugin.settings.embedMaxHeight = n;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("显示嵌入标题栏")
      .setDesc("在嵌入内容上方显示文件名与快捷操作按钮。")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showEmbedHeader).onChange(async (v) => {
          this.plugin.settings.showEmbedHeader = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("允许 HTML 运行脚本")
      .setDesc("关闭后嵌入的 HTML 文件中的 JavaScript 不会执行（更安全，但交互页面会失效）。")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.htmlAllowScripts).onChange(async (v) => {
          this.plugin.settings.htmlAllowScripts = v;
          await this.plugin.saveSettings();
        })
      );
  }
}
