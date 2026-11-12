#!/usr/bin/env node
/**
 * Copy build artifacts into a local Obsidian vault plugin folder for testing.
 *
 *   npm run deploy
 *   ANY_VIEWER_VAULT=/path/to/vault npm run deploy   # override target vault
 *
 * Deploys main.js / manifest.json / styles.css to
 *   <vault>/.obsidian/plugins/any-viewer/
 * (create the folder if missing; Obsidian picks the plugin up on next reload)
 */
const { cp, mkdir } = require("node:fs/promises");
const path = require("node:path");

const vault =
  process.env.ANY_VIEWER_VAULT ?? "/Users/tingke/Documents/Obsidian/Markdown";
const dest = path.join(vault, ".obsidian", "plugins", "any-viewer");
const root = path.resolve(__dirname, "..");
const FILES = ["main.js", "manifest.json", "styles.css"];

async function main() {
  await mkdir(dest, { recursive: true });
  for (const file of FILES) {
    await cp(path.join(root, file), path.join(dest, file));
    console.log(`deploy: ${file} → ${dest}`);
  }
}

main().catch((err) => {
  console.error("deploy failed:", err);
  process.exit(1);
});
