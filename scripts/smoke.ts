/* Smoke test: simulate Obsidian loading the plugin bundle. */
// Set up browser-ish globals before any dependency module executes.
(globalThis as any).window = globalThis;
(globalThis as any).self = globalThis;
(globalThis as any).document ??= {
  createElement: () => ({
    style: {},
    setAttribute() {}, appendChild() {}, removeChild() {}, addEventListener() {},
    remove() {}, classList: { add() {}, remove() {} },
  }),
  createElementNS: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  createTextNode: () => ({}),
  body: { appendChild() {}, removeChild() {} },
  documentElement: { style: {} },
  addEventListener() {},
};
(globalThis as any).navigator ??= { userAgent: "smoke" };
(globalThis as any).DOMParser = class {
  parseFromString() { return { querySelector: () => null, querySelectorAll: () => [] }; }
};
(globalThis as any).requestAnimationFrame = (cb: any) => setTimeout(() => cb(0), 0);

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
    adapter: { getResourcePath: () => "app://x", getFullPath: (p: string) => p },
    getConfig: () => "",
    getAbstractFileByPath: () => null,
    createBinary: async () => { throw new Error("smoke: no createBinary"); },
    createFolder: async () => {},
    getFiles: () => [],
    readBinary: async () => new ArrayBuffer(0),
    on: () => ({}),
  },
  metadataCache: {
    getFirstLinkpathDest: () => null,
    on: () => ({}),
    fileToLinktext: (f: any) => f?.name ?? "",
  },
  fileManager: {},
  lastEvent: null,
};

async function main() {
  const mod = await import("../src/main");
  const PluginClass = (mod as any).default;
  if (typeof PluginClass !== "function") throw new Error("default export missing");
  const plugin = new PluginClass(fakeApp, { id: "any-viewer", name: "Any Viewer", version: "0.1.0", dir: "/tmp" });
  console.log("[smoke] constructed");
  await plugin.onload();
  console.log("[smoke] onload OK");
  await plugin.onunload();
  console.log("[smoke] onunload OK");
  console.log("[smoke] PASS");
}

main().catch((err) => {
  console.error("[smoke] FAIL:", err && err.stack ? err.stack : err);
  process.exit(1);
});
