// Plain-JS stub of the 'obsidian' runtime for loading the built main.js in Node.
class Component {
  register(cb) { return cb; }
  registerEvent(ref) { return ref; }
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
class Plugin extends Component {
  constructor(app, manifest) { super(); this.app = app; this.manifest = manifest; }
  addRibbonIcon() { return null; }
  addSettingTab() {}
  addCommand(cmd) { return cmd; }
  registerView() {}
  registerExtensions(exts) {
    // Simulate the real conflict observed in Obsidian:
    // another plugin (styled-ms-office-viewer) already owns "docx".
    if (exts.includes("docx")) {
      throw new Error('Attempting to register an existing file extension "docx"');
    }
  }
  registerMarkdownPostProcessor() {}
  async loadData() { return null; }
  async saveData() {}
}
class PluginSettingTab {
  constructor(app, plugin) { this.app = app; this.plugin = plugin; }
  display() {}
  hide() {}
}
class Setting {
  setName() { return this; }
  setDesc() { return this; }
  setHeading() { return this; }
  addToggle() { return this; }
  addDropdown() { return this; }
  addText() { return this; }
}
class Notice { constructor() {} hide() {} setMessage() { return this; } }
class FileView {
  addAction() { return null; }
  getViewType() { return "stub"; }
  async onOpen() {}
  async onLoadFile() {}
}
class ItemView extends FileView {}
module.exports = {
  Component, Plugin, PluginSettingTab, Setting, Notice, FileView, ItemView,
  WorkspaceLeaf: class {}, TFile: class {}, TFolder: class {}, Vault: class {},
  App: class {}, Editor: class {}, MarkdownView: class {}, MarkdownFileInfo: class {},
  MarkdownPostProcessorContext: class {},
  Platform: { isDesktopApp: true, isDesktop: true, isMobileApp: false, isMobile: false },
  getIcon() { return null; },
  normalizePath: (p) => p,
};
