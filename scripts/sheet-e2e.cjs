/* E2E: render the user's real xlsx through src/sheet.ts with a fake DOM, then
   verify theme colors end up as inline styles on table cells. */
const path = require("node:path");
const fs = require("node:fs");

function fakeEl(tag) {
  const el = {
    tag,
    children: [],
    style: {},
    attrs: {},
    classes: new Set(),
    text: "",
    _listeners: {},
    addClass(c) { el.classes.add(c); },
    remove() {},
    empty() { el.children.length = 0; },
    setText(t) { el.text = t; },
    setAttribute(k, v) { el.attrs[k] = v; },
    appendChild(c) { el.children.push(c); return c; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(ev, fn) { (el._listeners[ev] ??= []).push(fn); },
    createDiv(o) { const d = fakeEl("div"); if (o?.cls) d.classes.add(o.cls); if (o?.text) d.text = o.text; el.children.push(d); return d; },
    createEl(t, o) { const c = fakeEl(t); if (o?.cls) c.classes.add(o.cls); if (o?.text) c.text = o.text; if (o?.attr) Object.assign(c.attrs, o.attr); el.children.push(c); return c; },
  };
  return el;
}

async function main() {
  const { renderSheet } = require("./sheet-bundle.cjs");
  const dataPath = "/Users/tingke/Documents/Obsidian/Markdown/4-Archived/Books/家装预算.xlsx";
  const buf = fs.readFileSync(dataPath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  const container = fakeEl("div");
  await renderSheet(container, { extension: "xlsx" }, ab);

  // collect all td inline styles from the fake tree
  const tds = [];
  const walk = (n) => {
    if (!n) return;
    if (n.tag === "td") tds.push(n);
    for (const c of n.children ?? []) walk(c);
  };
  walk(container);

  const joined = tds.map((t) => t.attrs.style ?? "").join(" | ");
  console.log("total tds:", tds.length);
  const checks = {
    "表头蓝 #5B9BD5": joined.toUpperCase().includes("#5B9BD5"),
    "黄条 #FFE699": joined.toUpperCase().includes("#FFE699"),
    "浅蓝 #BDD7EE": joined.toUpperCase().includes("#BDD7EE"),
    "无 NaN/undefined": !/NaN|undefined/.test(joined),
  };
  let ok = true;
  for (const [k, v] of Object.entries(checks)) {
    console.log(v ? `  ✔ ${k}` : `  ✘ ${k}`);
    if (!v) ok = false;
  }
  // sample a styled td
  const sample = tds.find((t) => (t.attrs.style ?? "").includes("background"));
  console.log("sample styled td:", sample ? sample.attrs.style.slice(0, 160) : "(none)");
  if (!ok) process.exit(1);
  console.log("SHEET E2E PASS");
}

main().catch((e) => { console.error("E2E FAIL:", e && e.stack ? e.stack : e); process.exit(1); });
