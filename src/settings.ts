import { App, PluginSettingTab, SettingDefinition, SettingDefinitionItem, normalizePath } from "obsidian";
import AnyViewerPlugin from "./main";
import { t } from "./i18n";

export type AttachmentLocation = "obsidian" | "current" | "custom";

export interface AnyViewerSettings {
  /** UI language: auto (follow Obsidian) / zh / en. */
  language: "auto" | "zh" | "en";
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

/**
 * Declarative settings (Obsidian 1.13+): definitions feed both rendering and
 * the settings search index. Control values are persisted via
 * getControlValue/setControlValue on this tab.
 */
export class AnyViewerSettingTab extends PluginSettingTab {
  plugin: AnyViewerPlugin;

  constructor(app: App, plugin: AnyViewerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const T = t(this.plugin.settings);
    type SettingsKey = keyof AnyViewerSettings;
    const toggle = (
      key: SettingsKey,
      name: string,
      desc?: string
    ): SettingDefinition => ({
      name,
      desc,
      control: { type: "toggle", key, defaultValue: false },
    });

    return [
      {
        name: T.settingsLanguage,
        desc: T.settingsLanguageDesc,
        control: {
          type: "dropdown",
          key: "language",
          defaultValue: "auto",
          options: { auto: "Auto / 自动", zh: "中文", en: "English" },
        },
      },

      {
        type: "group",
        heading: T.settingsInsert,
        items: [
          {
            name: T.settingsAttachmentLocation,
            desc: T.settingsAttachmentLocationDesc,
            control: {
              type: "dropdown",
              key: "attachmentLocation",
              defaultValue: "obsidian",
              options: {
                obsidian: T.settingsLocObsidian,
                current: T.settingsLocCurrent,
                custom: T.settingsLocCustom,
              },
            },
          },
          {
            name: T.settingsCustomFolder,
            desc: T.settingsCustomFolderDesc,
            visible: () => this.plugin.settings.attachmentLocation === "custom",
            control: { type: "folder", key: "customAttachmentPath", defaultValue: "attachments" },
          },
          toggle("interceptPaste", T.settingsInterceptPaste, T.settingsInterceptPasteDesc),
          toggle("interceptDrop", T.settingsInterceptDrop, T.settingsInterceptDropDesc),
          toggle("interceptImages", T.settingsInterceptImages, T.settingsInterceptImagesDesc),
        ],
      },

      {
        type: "group",
        heading: T.settingsFormats,
        items: [
          toggle("enableDocx", T.settingsEnableDocx, T.settingsFormatDesc),
          toggle("enableSheet", T.settingsEnableSheet, T.settingsFormatDesc),
          toggle("enablePptx", T.settingsEnablePptx, T.settingsFormatDesc),
          toggle("enableHtml", T.settingsEnableHtml, `${T.settingsHtmlDesc} ${T.settingsFormatDesc}`),
          toggle("enableFallbackCard", T.settingsFallbackCard, T.settingsFallbackCardDesc),
        ],
      },

      {
        type: "group",
        heading: T.settingsAppearance,
        items: [
          {
            name: T.settingsMaxHeight,
            desc: T.settingsMaxHeightDesc,
            control: { type: "number", key: "embedMaxHeight", defaultValue: 420, min: 100, max: 10000, step: 1 },
          },
          toggle("showEmbedHeader", T.settingsShowHeader, T.settingsShowHeaderDesc),
          toggle("htmlAllowScripts", T.settingsAllowScripts, T.settingsAllowScriptsDesc),
        ],
      },
    ];
  }

  /** Declarative controls read from `this.plugin.settings`. */
  getControlValue(key: string): unknown {
    const store = this.plugin.settings as unknown as Record<string, unknown>;
    return store[key];
  }

  /** Declarative controls persist through `plugin.saveSettings()`. */
  setControlValue(key: string, value: unknown): void {
    const store = this.plugin.settings as unknown as Record<string, unknown>;
    if (key === "customAttachmentPath" && typeof value === "string") {
      store[key] = normalizePath(value.trim() || "attachments");
    } else {
      store[key] = value;
    }
    void this.plugin.saveSettings();
  }
}
