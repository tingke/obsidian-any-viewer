// Minimal runtime stub of the 'obsidian' module, enough to import & onload() the plugin.
export class Component {
  register(cb: any) { return cb; }
  registerEvent(ref: any) { return ref; }
  registerDomEvent() {}
  registerMarkdownPostProcessor() {}
  registerMarkdownCodeBlockProcessor() {}
  registerEditorExtension() {}
  registerObsidianProtocolHandler() {}
  addChild() {}
  load() {}
  unload() {}
  onunload() {}
}

export class Plugin extends Component {
  app: any;
  manifest: any;
  constructor(app: any, manifest: any) { super(); this.app = app; this.manifest = manifest; }
  addRibbonIcon(..._a: any[]) { return null as any; }
  addSettingTab(..._a: any[]) {}
  addCommand(cmd: any) { return cmd; }
  registerView(..._a: any[]) {}
  registerExtensions(..._a: any[]) {}
  registerMarkdownPostProcessor(..._a: any[]) {}
  async loadData() { return null as any; }
  async saveData(..._a: any[]) {}
}

export class PluginSettingTab {
  app: any; plugin: any; containerEl: any;
  constructor(app: any, plugin: any) { this.app = app; this.plugin = plugin; }
  display() {}
  hide() {}
}

export class Setting {
  constructor(..._a: any[]) {}
  setName(..._a: any[]) { return this; }
  setDesc(..._a: any[]) { return this; }
  setHeading(..._a: any[]) { return this; }
  addToggle(..._a: any[]) { return this; }
  addDropdown(..._a: any[]) { return this; }
  addText(..._a: any[]) { return this; }
}

export class Notice {
  static notice(..._a: any[]) {}
  constructor(..._a: any[]) {}
  hide() {}
  setMessage(..._a: any[]) { return this; }
}

export class FileView {
  file: any; contentEl: any; app: any; leaf: any;
  constructor(..._a: any[]) {}
  addAction(..._a: any[]) { return null as any; }
  getViewType() { return "stub"; }
  getDisplayText() { return "stub"; }
  getIcon() { return "file"; }
  async onOpen() {}
  async onLoadFile(_f: any) {}
}

export class ItemView extends FileView {}
export class WorkspaceLeaf {}
export class TFile {}
export class TFolder {}
export class Vault {}
export class App {}
export class Editor {}
export class MarkdownView {}
export class MarkdownFileInfo {}
export class MarkdownPostProcessorContext {}

export const Platform = {
  isDesktopApp: true,
  isDesktop: true,
  isMobileApp: false,
  isMobile: false,
  isIosApp: false,
  isAndroidApp: false,
};

export function getIcon(_name: string) { return null; }
export function normalizePath(path: string) { return path; }
export function createDiv(..._a: any[]) { return {} as any; }
