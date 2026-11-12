/* ============================================================
 * any-viewer · pre-release official lint (scripts/lint-obsidian.mjs)
 *
 * Runs the official `eslint-plugin-obsidianmd` (recommended preset) — the
 * same rule set the community store's automated review applies. Before a
 * store submission this must come back 0 errors / 0 warnings: errors block
 * the review outright, warnings are the most common source of review
 * feedback.
 *
 * Ported from bz-reader's scripts/lint-obsidian.mjs (Windows → macOS), with
 * two deliberate differences:
 *  - toolchain lives in a fixed cache dir OUTSIDE the repo (no pnpm store
 *    coupling, and the gate stays pinned regardless of devDependencies
 *    drift):  ~/Library/Caches/any-viewer-lint   (override:
 *    ANY_VIEWER_LINT_HOME=/path)
 *  - this repo DOES track its own eslint.config.mjs, so the generated temp
 *    config uses a different filename and cleanup() only ever removes that
 *    temp file — never the committed config.
 *
 * Usage:
 *   node scripts/lint-obsidian.mjs             # full src tree
 *   node scripts/lint-obsidian.mjs --fix       # autofix what can be fixed
 *
 * The exit code is passed through: 0 = clean, non-zero = problems (the
 * release flow must stop on non-zero).
 * ============================================================ */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const TOOLS =
  process.env.ANY_VIEWER_LINT_HOME ||
  path.join(os.homedir(), "Library", "Caches", "any-viewer-lint");
const PLUGIN_DIR = path.join(TOOLS, "node_modules", "eslint-plugin-obsidianmd");
const ESLINT_BIN = path.join(TOOLS, "node_modules", "eslint", "bin", "eslint.js");
const TEMP_CONFIG = path.join(process.cwd(), ".eslint-obsidian.tmp.config.mjs");

// Pinned toolchain, same idea as upstream bz-reader: the official gate must
// not drift with the repo's devDependencies.
const PKGS = [
  "eslint@9",
  "@eslint/js@9",
  "typescript-eslint@8",
  "globals",
  "eslint-plugin-obsidianmd@0.4.2",
];

function ensureTools() {
  if (fs.existsSync(PLUGIN_DIR) && fs.existsSync(ESLINT_BIN)) return;
  console.log(`[lint-obsidian] 首次运行，安装工具链到 ${TOOLS} …`);
  try {
    fs.mkdirSync(TOOLS, { recursive: true });
  } catch (err) {
    console.error(
      `[lint-obsidian] 无法创建工具目录 ${TOOLS}（${err.code ?? err}）。` +
        `若是沙箱/权限限制，可改用仓库内目录：ANY_VIEWER_LINT_HOME=.lint-tools node scripts/lint-obsidian.mjs`
    );
    process.exit(1);
  }
  const pkgJson = path.join(TOOLS, "package.json");
  if (!fs.existsSync(pkgJson)) {
    fs.writeFileSync(pkgJson, JSON.stringify({ name: "any-viewer-lint", private: true }, null, 2));
  }
  const r = spawnSync("npm", ["install", "--no-audit", "--no-fund", "--legacy-peer-deps", ...PKGS], {
    cwd: TOOLS,
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) {
    console.error("[lint-obsidian] 工具链安装失败，检查网络后重试");
    process.exit(r.status ?? 1);
  }
}

/**
 * The config must sit at the repo root: ESLint 9's base path follows the
 * config file, so `src/**` targets only resolve from a root-level config.
 * Plugin and globals are imported from the external toolchain via absolute
 * file URLs so the gate works even in a fresh clone without node_modules.
 */
function writeTempConfig() {
  const pluginUrl = pathToFileURL(path.join(PLUGIN_DIR, "dist", "lib", "index.js")).href;
  const requireFromTools = createRequire(path.join(TOOLS, "package.json"));
  const globalsUrl = pathToFileURL(requireFromTools.resolve("globals")).href;
  const rootDir = process.cwd().replace(/\\/g, "/");
  fs.writeFileSync(
    TEMP_CONFIG,
    [
      `import obsidianmd from ${JSON.stringify(pluginUrl)};`,
      `import globals from ${JSON.stringify(globalsUrl)};`,
      "",
      "export default [",
      "  {",
      "    languageOptions: {",
      "      globals: { ...globals.browser },",
      "      parserOptions: {",
      "        projectService: {",
      "          allowDefaultProject: [\"eslint.config.mjs\"],",
      "        },",
      `        tsconfigRootDir: ${JSON.stringify(rootDir)},`,
      "      },",
      "    },",
      "  },",
      "  ...obsidianmd.configs.recommended,",
      "];",
      "",
    ].join("\n"),
  );
}

function cleanup() {
  try {
    if (fs.existsSync(TEMP_CONFIG)) fs.rmSync(TEMP_CONFIG, { force: true });
  } catch {
    /* cleanup failure doesn't change the verdict */
  }
}

ensureTools();
writeTempConfig();
/**
 * The exit code lives OUTSIDE the try: process.exit() kills the process
 * immediately, so a code inside try would skip the finally-cleanup and leave
 * the temp config behind (where `git add -A` would sweep it into a commit).
 */
let exitCode = 1;
try {
  const fix = process.argv.includes("--fix");
  const args = [ESLINT_BIN, "--config", TEMP_CONFIG, "src/**/*.ts", "-f", "stylish"];
  if (fix) args.push("--fix");
  const r = spawnSync(process.execPath, args, { cwd: process.cwd(), stdio: "inherit" });
  exitCode = r.status ?? 1;
  if (exitCode === 0) {
    console.log("[lint-obsidian] 干净：0 error / 0 warning —— 上架门禁通过");
  } else {
    console.error("[lint-obsidian] 有问题：上架前必须清零（error 直接卡审，warning 是审评意见高频来源）");
  }
} finally {
  cleanup();
}
process.exit(exitCode);
