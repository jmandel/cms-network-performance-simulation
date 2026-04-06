/**
 * Build script: produces dist/ with index.html, d3.min.js, sim.js
 *
 *  bun run build.ts          # uses cached sweep data
 *  bun run build.ts --fresh  # regenerates sweep data
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

mkdirSync("dist", { recursive: true });

// 1. Bundle sim for browser
console.log("Bundling sim...");
const simBuild = await Bun.build({
  entrypoints: ["./sim_browser.ts"],
  target: "browser",
  minify: true,
});
const simJs = await simBuild.outputs[0].text();
writeFileSync("dist/sim.js", simJs);
console.log(`  dist/sim.js: ${(simJs.length / 1024).toFixed(0)} KB`);

// 2. Copy d3 from node_modules
const d3Js = readFileSync("node_modules/d3/dist/d3.min.js", "utf8");
writeFileSync("dist/d3.min.js", d3Js);
console.log(`  dist/d3.min.js: ${(d3Js.length / 1024).toFixed(0)} KB`);

// 3. Generate sweep data (or use cached)
let sweepJson: string;
if (existsSync("sweep_data.json") && !process.argv.includes("--fresh")) {
  console.log("Using cached sweep_data.json (pass --fresh to regenerate)");
  sweepJson = readFileSync("sweep_data.json", "utf8");
} else {
  console.log("Generating sweep data (~50 simulations, may take a few minutes)...");
  const sweepProc = Bun.spawnSync(["bun", "generate_sweep.ts"]);
  sweepJson = sweepProc.stdout.toString();
  writeFileSync("sweep_data.json", sweepJson);
}
console.log(`  sweep_data: ${(sweepJson.length / 1024).toFixed(0)} KB`);

// 4. Build index.html from report.html template
let html = readFileSync("report.html", "utf8");

// Inject sweep data
if (html.includes("SWEEP_DATA_PLACEHOLDER")) {
  html = html.replace("SWEEP_DATA_PLACEHOLDER", sweepJson);
} else {
  const dataStart = html.indexOf("const DATA = ");
  if (dataStart > 0) {
    const dataEnd = html.indexOf(";\nconst B = ", dataStart);
    if (dataEnd > 0) {
      html = html.substring(0, dataStart) + "const DATA = " + sweepJson + html.substring(dataEnd);
    }
  }
}

// Point d3 and sim to local files instead of CDN/dist
html = html.replace(
  '<script src="https://d3js.org/d3.v7.min.js"></script>',
  '<script src="d3.min.js"></script>'
);
html = html.replace(
  '<script src="dist/sim.js"></script>',
  '<script src="sim.js"></script>'
);

writeFileSync("dist/index.html", html);
console.log(`\nWrote dist/index.html (${(html.length / 1024).toFixed(0)} KB) + d3.min.js + sim.js`);
