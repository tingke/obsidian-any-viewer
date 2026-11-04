/* Loads the REAL built main.js exactly like Obsidian would (CJS require with 'obsidian' provided). */
const path = require("node:path");
const Module = require("node:module");

globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.localStorage = {
  getItem: () => null,
  setItem() {},
  removeItem() {},
};
globalThis.document = globalThis.document || {
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, remove() {}, classList: { add() {}, remove() {} } }),
  createElementNS: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  createTextNode: () => ({}),
  body: { appendChild() {}, removeChild() {} },
  documentElement: { style: {} },
  addEventListener() {},
};
globalThis.navigator = globalThis.navigator || { userAgent: "node" };
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);

const stubPath = require.resolve("./obsidian-stub.cjs");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "obsidian") return stubPath;
  return origResolve.call(this, request, ...args);
};

const fakeApp = {
  workspace: {
    on: () => ({}),
    offref: () => {},
    getActiveFile: () => null,
    activeEditor: null,
    getLeaf: () => ({ openFile: async () => {} }),
    detachLeavesOfType: () => {},
  },
  vault: {
    adapter: { getResourcePath: () => "app://x", getFullPath: (p) => p },
    getConfig: () => "",
    getAbstractFileByPath: () => null,
    createBinary: async () => { throw new Error("no"); },
    createFolder: async () => {},
    getFiles: () => [],
    readBinary: async () => new ArrayBuffer(0),
    on: () => ({}),
  },
  metadataCache: { getFirstLinkpathDest: () => null, on: () => ({}), fileToLinktext: (f) => f?.name ?? "" },
  fileManager: {},
};

const mainPath = path.join(__dirname, "..", "main.js");
const mod = require(mainPath);
const PluginClass = mod && mod.default;
if (typeof PluginClass !== "function") {
  console.error("[artifact] FAIL: no default export, got:", typeof PluginClass, Object.keys(mod || {}));
  process.exit(1);
}
const plugin = new PluginClass(fakeApp, { id: "any-viewer", name: "Any Viewer", version: "0.1.0" });
plugin
  .onload()
  .then(() => plugin.onunload())
  .then(() => console.log("[artifact] PASS: built main.js loads, onload & onunload OK"))
  .catch((err) => {
    console.error("[artifact] FAIL:", err && err.stack ? err.stack : err);
    process.exit(1);
  });
