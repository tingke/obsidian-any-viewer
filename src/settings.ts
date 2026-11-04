import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";
import AnyViewerPlugin from "./main";
import { UiLanguage, t } from "./i18n";

export type AttachmentLocation = "obsidian" | "current" | "custom";

export interface AnyViewerSettings {
  /** UI language: auto (follow Obsidian) / zh / en. */
  language: UiLanguage;
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
  language: "auto",
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
    const T = t(this.plugin.settings);
    containerEl.empty();

    new Setting(containerEl).setName(T.settingsLanguage).setDesc(T.settingsLanguageDesc).setHeading();
    new Setting(containerEl)
      .setName(T.settingsLanguage)
      .addDropdown((d) =>
        d
          .addOption("auto", "Auto / 自动")
          .addOption("zh", "中文")
          .addOption("en", "English")
          .setValue(this.plugin.settings.language)
          .onChange(async (v) => {
            this.plugin.settings.language = v as UiLanguage;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl).setName(T.settingsInsert).setHeading();

    new Setting(containerEl)
      .setName(T.settingsAttachmentLocation)
      .setDesc(T.settingsAttachmentLocationDesc)
      .addDropdown((d) =>
        d
          .addOption("obsidian", T.settingsLocObsidian)
          .addOption("current", T.settingsLocCurrent)
          .addOption("custom", T.settingsLocCustom)
          .setValue(this.plugin.settings.attachmentLocation)
          .onChange(async (v) => {
            this.plugin.settings.attachmentLocation = v as AttachmentLocation;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (this.plugin.settings.attachmentLocation === "custom") {
      new Setting(containerEl)
        .setName(T.settingsCustomFolder)
        .setDesc(T.settingsCustomFolderDesc)
        .addText((txt) =>
          txt
            .setPlaceholder("attachments")
            .setValue(this.plugin.settings.customAttachmentPath)
            .onChange(async (v) => {
              this.plugin.settings.customAttachmentPath = normalizePath(v.trim() || "attachments");
              await this.plugin.saveSettings();
            })
        );
    }

    new Setting(containerEl)
      .setName(T.settingsInterceptPaste)
      .setDesc(T.settingsInterceptPasteDesc)
      .addToggle((tog) =>
        tog.setValue(this.plugin.settings.interceptPaste).onChange(async (v) => {
          this.plugin.settings.interceptPaste = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(T.settingsInterceptDrop)
      .setDesc(T.settingsInterceptDropDesc)
      .addToggle((tog) =>
        tog.setValue(this.plugin.settings.interceptDrop).onChange(async (v) => {
          this.plugin.settings.interceptDrop = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(T.settingsInterceptImages)
      .setDesc(T.settingsInterceptImagesDesc)
      .addToggle((tog) =>
        tog.setValue(this.plugin.settings.interceptImages).onChange(async (v) => {
          this.plugin.settings.interceptImages = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName(T.settingsFormats).setHeading();

    new Setting(containerEl)
      .setName(T.settingsEnableDocx)
      .setDesc(T.settingsFormatDesc)
      .addToggle((tog) =>
        tog.setValue(this.plugin.settings.enableDocx).onChange(async (v) => {
          this.plugin.settings.enableDocx = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(T.settingsEnableSheet)
      .setDesc(T.settingsFormatDesc)
      .addToggle((tog) =>
        tog.setValue(this.plugin.settings.enableSheet).onChange(async (v) => {
          this.plugin.settings.enableSheet = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(T.settingsEnablePptx)
      .setDesc(T.settingsFormatDesc)
      .addToggle((tog) =>
        tog.setValue(this.plugin.settings.enablePptx).onChange(async (v) => {
          this.plugin.settings.enablePptx = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(T.settingsEnableHtml)
      .setDesc(T.settingsHtmlDesc + T.settingsFormatDesc)
      .addToggle((tog) =>
        tog.setValue(this.plugin.settings.enableHtml).onChange(async (v) => {
          this.plugin.settings.enableHtml = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(T.settingsFallbackCard)
      .setDesc(T.settingsFallbackCardDesc)
      .addToggle((tog) =>
        tog.setValue(this.plugin.settings.enableFallbackCard).onChange(async (v) => {
          this.plugin.settings.enableFallbackCard = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName(T.settingsAppearance).setHeading();

    new Setting(containerEl)
      .setName(T.settingsMaxHeight)
      .setDesc(T.settingsMaxHeightDesc)
      .addText((txt) =>
        txt.setValue(String(this.plugin.settings.embedMaxHeight)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (!Number.isNaN(n) && n >= 100 && n <= 10000) {
            this.plugin.settings.embedMaxHeight = n;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName(T.settingsShowHeader)
      .setDesc(T.settingsShowHeaderDesc)
      .addToggle((tog) =>
        tog.setValue(this.plugin.settings.showEmbedHeader).onChange(async (v) => {
          this.plugin.settings.showEmbedHeader = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(T.settingsAllowScripts)
      .setDesc(T.settingsAllowScriptsDesc)
      .addToggle((tog) =>
        tog.setValue(this.plugin.settings.htmlAllowScripts).onChange(async (v) => {
          this.plugin.settings.htmlAllowScripts = v;
          await this.plugin.saveSettings();
        })
      );
  }
}
