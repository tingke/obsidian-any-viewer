import esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
await esbuild.build({
  entryPoints: [path.join(root, "smoke.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  alias: { obsidian: path.join(root, "obsidian-stub.ts") },
  outfile: path.join(root, "..", "smoke.cjs"),
  logLevel: "warning",
  sourcemap: false,
});
console.log("smoke bundle written");
