/**
 * Build script: produces dist/ with index.html, d3.min.js, sim.js, app.js
 *
 *  bun run build.ts          # uses cached sweep data
 *  bun run build.ts --fresh  # forces regeneration of scenario bundles
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { computeSweepInputHash, SWEEP_ARTIFACT_KIND } from "./sweep_meta";

mkdirSync("dist", { recursive: true });

// 1. Bundle React app (includes sim directly)
console.log("Bundling app (React + sim)...");
const appBuild = await Bun.build({
  entrypoints: ["./src/app.tsx"],
  target: "browser",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  // d3 loaded as global <script>, not bundled
  external: ["d3"],
});
if (!appBuild.success) {
  console.error("App build failed:");
  appBuild.logs.forEach((l) => console.error(l));
  process.exit(1);
}
const appJs = await appBuild.outputs[0].text();
writeFileSync("dist/app.js", appJs);
console.log(`  dist/app.js: ${(appJs.length / 1024).toFixed(0)} KB`);

// 3. Copy d3
const d3Js = readFileSync("node_modules/d3/dist/d3.min.js", "utf8");
writeFileSync("dist/d3.min.js", d3Js);
console.log(`  dist/d3.min.js: ${(d3Js.length / 1024).toFixed(0)} KB`);

// 4. Scenario bundle data
let sweepJson: string;
const freshRequested = process.argv.includes("--fresh");
const expectedHash = computeSweepInputHash();
let canUseCache = false;

if (existsSync("sweep_data.json") && !freshRequested) {
  try {
    const cached = JSON.parse(readFileSync("sweep_data.json", "utf8"));
    canUseCache =
      cached?.meta?.kind === SWEEP_ARTIFACT_KIND &&
      cached?.meta?.inputHash === expectedHash;
    if (canUseCache) {
      console.log("Using cached sweep_data.json (inputs unchanged)");
      sweepJson = JSON.stringify(cached);
    } else {
      console.log("Cached sweep_data.json is stale; regenerating");
    }
  } catch {
    console.log("Cached sweep_data.json is unreadable; regenerating");
  }
}

if (!canUseCache) {
  console.log("Generating scenario bundle data...");
  const proc = Bun.spawnSync(["bun", "generate_sweep.ts"]);
  if (proc.exitCode !== 0) {
    console.error("Scenario bundle generation failed");
    process.exit(proc.exitCode ?? 1);
  }
  sweepJson = proc.stdout.toString();
  writeFileSync("sweep_data.json", sweepJson);
}
console.log(`  sweep_data: ${(sweepJson.length / 1024).toFixed(0)} KB`);

// 5. Build index.html from template
let html = readFileSync("report-template.html", "utf8");
html = html.replace("__SWEEP_DATA_PLACEHOLDER__", sweepJson);
writeFileSync("dist/index.html", html);

console.log(`\ndist/index.html: ${(html.length / 1024).toFixed(0)} KB`);
console.log(`Total dist: ${["index.html", "app.js", "d3.min.js"].map((f) => `${f} (${(readFileSync(`dist/${f}`).length / 1024).toFixed(0)}KB)`).join(", ")}`);
