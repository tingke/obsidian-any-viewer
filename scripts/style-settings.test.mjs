#!/usr/bin/env node
// Style Settings consistency checks (v0.6 style-settings package, T7):
//   1. every `var(--av-opt-*)` referenced in styles.css has an `id:` entry in
//      the @settings block, and vice versa (no drifting/missing controls);
//   2. the @settings `default:` of each size control matches the FIRST calc()
//      fallback of that variable in styles.css (bare-install zero-regression);
//   3. form classes consumed in CSS selectors all exist as class-toggle /
//      class-select ids in @settings (or are their select values).
import assert from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.resolve(here, "..", "styles.css"), "utf8");

// --- extract the @settings block ---
const block = /\/\* @settings\n([\s\S]*?)\n\*\//.exec(css);
assert.ok(block, "@settings block present in styles.css");
const yaml = block[1];

// --- collect ids per setting type ---
const settings = yaml.split(/\n(?=  - id:)/g).filter((entry) => entry.includes("- id:"));
const ids = new Map(); // id -> raw entry
for (const entry of settings) {
  const id = /^\s*- id:\s*(\S+)/m.exec(entry)?.[1];
  assert.ok(id, "every settings entry has an id");
  ids.set(id, entry);
}

// --- 1. referenced opt variables vs @settings ids ---
const referenced = new Set([...css.matchAll(/var\((--av-opt-[\w-]+)/g)].map((m) => m[1].slice("--av-opt-".length)));
const declared = new Set([...ids.keys()].filter((id) => id.startsWith("av-opt-")).map((id) => id.slice("av-opt-".length)));
for (const ref of referenced) {
  assert.ok(declared.has(ref), `var(--av-opt-${ref}) referenced in styles.css but missing from @settings`);
}
for (const id of declared) {
  assert.ok(referenced.has(id), `@settings id "${id}" declared but never consumed in styles.css`);
}

// --- 2. defaults match first calc() fallback ---
for (const id of declared) {
  const entry = ids.get(id);
  const type = /type:\s*(\S+)/.exec(entry)?.[1];
  if (type !== "variable-number-slider" && type !== "variable-select") continue;
  const def = /default:\s*["']?([\d.]+)/.exec(entry)?.[1];
  assert.ok(def, `${id} has a numeric default`);
  const fallback = new RegExp(`var\\(--av-opt-${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},\\s*([\\d.]+)\\)`).exec(css)?.[1];
  assert.ok(fallback !== undefined, `${id} has a calc(var(--av-opt-${id}, N)) fallback in styles.css`);
  assert.equal(Number(fallback), Number(def), `${id}: @settings default (${def}) matches first styles.css fallback (${fallback})`);
}

// --- 3. form classes: CSS selectors ↔ class-toggle/class-select entries ---
// class-toggle: the id IS the body class; class-select: each option `value:` is.
const formClasses = new Set([...css.matchAll(/body\.(av-[a-z-]+)/g)].map((m) => m[1]));
const declaredClasses = new Set();
for (const [id, entry] of ids) {
  if (/type:\s*class-toggle/.test(entry)) declaredClasses.add(id);
  if (/type:\s*class-select/.test(entry)) {
    for (const value of entry.matchAll(/^\s*value:\s*(\S+)/gm)) declaredClasses.add(value[1]);
  }
}
for (const cls of formClasses) {
  assert.ok(declaredClasses.has(cls), `body.${cls} used in styles.css but not declared as a @settings class entry`);
}

// --- 4. themed colors carry both light and dark defaults ---
for (const id of declared) {
  const entry = ids.get(id);
  if (!/type:\s*variable-themed-color/.test(entry)) continue;
  assert.ok(/default-light:/.test(entry) && /default-dark:/.test(entry), `${id} declares default-light and default-dark`);
}

console.log("style-settings: @settings ↔ styles.css consistent (ids, defaults, form classes)");
