#!/usr/bin/env node
// Unit tests for src/fragment.ts (display-syntax parser).
// Bundles the TS source with esbuild on the fly (no prebuilt artifacts), then
// asserts the grammar rules: page forms, ranges, normalization, open ends,
// sheet/range/row forms, element ids, and fallback semantics.
import { createRequire } from "node:module";
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = mkdtempSync(path.join(tmpdir(), "av-fragment-"));
const outFile = path.join(outDir, "fragment.cjs");

esbuild.buildSync({
  entryPoints: [path.resolve(here, "..", "src", "fragment.ts")],
  bundle: true,
  format: "cjs",
  outfile: outFile,
  logLevel: "error",
});

let failures = 0;
try {
  const { parseFragment, formatCellRange, OPEN_END } = require(outFile);
  const pages = (raw, kind = "pptx") => {
    const f = parseFragment(raw, kind);
    return f && f.type === "pages" ? [f.start, f.end] : null;
  };

  // --- pptx/docx page forms ---
  assert.deepEqual(pages("page=3"), [3, 3]);
  assert.deepEqual(pages("3", "docx"), [3, 3]);
  assert.deepEqual(pages("page=3~10"), [3, 10]);
  assert.deepEqual(pages("3~10", "docx"), [3, 10]);
  assert.deepEqual(pages("3-10"), [3, 10]);
  assert.deepEqual(pages("3~"), [3, OPEN_END]);
  assert.deepEqual(pages("page=3~", "docx"), [3, OPEN_END]);
  // reversed ranges normalize (swap)
  assert.deepEqual(pages("page=8~3"), [3, 8]);
  assert.deepEqual(pages("10-3"), [3, 10]);
  // invalid / fallback semantics
  assert.equal(pages("page=0"), null);
  assert.equal(pages("page=abc"), null);
  assert.equal(pages("page=3~x"), null);
  assert.equal(parseFragment("附录", "docx"), null);
  assert.equal(parseFragment("Page=3", "pptx").start, 3); // case-insensitive

  // --- sheet forms ---
  const s1 = parseFragment("Sheet2", "sheet");
  assert.equal(s1.type, "sheet");
  assert.equal(s1.name, "Sheet2");
  const s2 = parseFragment("sheet 2", "sheet"); // name with spaces
  assert.equal(s2.name, "sheet 2");
  const r1 = parseFragment("A1:D10", "sheet");
  assert.equal(r1.type, "sheetRange");
  assert.deepEqual(r1.range, { sc: 1, sr: 1, ec: 4, er: 10 });
  assert.equal(r1.isRowForm, false);
  const r2 = parseFragment("D10:A1", "sheet"); // swap
  assert.deepEqual(r2.range, { sc: 1, sr: 1, ec: 4, er: 10 });
  const r3 = parseFragment("5:20", "sheet"); // row form → all columns
  assert.equal(r3.type, "sheetRange");
  assert.equal(r3.isRowForm, true);
  assert.deepEqual(r3.range, { sc: 1, sr: 5, ec: 0, er: 20 });
  const r4 = parseFragment("Sheet 2!A1:D10", "sheet"); // split at LAST "!"
  assert.equal(r4.type, "sheetRange");
  assert.equal(r4.sheet, "Sheet 2");
  const r5 = parseFragment("2024年报表!5:20", "sheet");
  assert.equal(r5.type, "sheetRange");
  assert.equal(r5.sheet, "2024年报表");
  assert.equal(r5.isRowForm, true);
  const r6 = parseFragment("bad!notrange", "sheet"); // right side not a range → whole is a name
  assert.equal(r6.type, "sheet");
  assert.equal(r6.name, "bad!notrange");
  assert.equal(parseFragment("Z9:Z8", "sheet").range.sc, 26); // column letters

  // --- html / card ---
  const h = parseFragment("header", "html");
  assert.equal(h.type, "element");
  assert.equal(h.id, "header");
  assert.equal(parseFragment("anything", "card"), null);

  // --- formatCellRange ---
  assert.equal(formatCellRange({ sc: 1, sr: 1, ec: 4, er: 10 }), "A1:D10");
  assert.equal(formatCellRange({ sc: 26, sr: 5, ec: 28, er: 20 }), "Z5:AB20");
  assert.equal(formatCellRange({ sc: 1, sr: 5, ec: 0, er: 20 }), "A5:20");

  console.log("fragment parser: all assertions passed");
} catch (err) {
  failures = 1;
  console.error(err);
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
process.exit(failures);
