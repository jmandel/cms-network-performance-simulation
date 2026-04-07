/**
 * Build script: produces dist/ with index.html, d3.min.js, sim.js, app.js
 *
 *  bun run build.ts          # uses cached sweep data
 *  bun run build.ts --fresh  # regenerates sweep data (~50 sims)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from "fs";

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

// 4. Sweep data
let sweepJson: string;
if (existsSync("sweep_data.json") && !process.argv.includes("--fresh")) {
  console.log("Using cached sweep_data.json (pass --fresh to regenerate)");
  sweepJson = readFileSync("sweep_data.json", "utf8");
} else {
  console.log("Generating sweep data (~50 simulations)...");
  const proc = Bun.spawnSync(["bun", "generate_sweep.ts"]);
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
