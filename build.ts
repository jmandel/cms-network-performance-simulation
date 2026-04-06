/**
 * Build script: produces dist/index.html with d3 and sim inlined.
 *
 *  bun run build.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";

// 1. Bundle sim for browser
console.log("Bundling sim...");
const simBuild = await Bun.build({
  entrypoints: ["./sim_browser.ts"],
  target: "browser",
  minify: true,
});
const simJs = await simBuild.outputs[0].text();
console.log(`  sim.js: ${(simJs.length / 1024).toFixed(0)} KB`);

// 2. Read d3 from node_modules
const d3Js = readFileSync("node_modules/d3/dist/d3.min.js", "utf8");
console.log(`  d3.min.js: ${(d3Js.length / 1024).toFixed(0)} KB`);

// 3. Generate sweep data
console.log("Generating sweep data...");
const sweepProc = Bun.spawnSync(["bun", "generate_sweep.ts"]);
const sweepJson = sweepProc.stdout.toString();
console.log(`  sweep_data: ${(sweepJson.length / 1024).toFixed(0)} KB`);

// 4. Read report.html template (with SWEEP_DATA_PLACEHOLDER or already injected)
let html = readFileSync("report.html", "utf8");

// If placeholder exists, inject sweep data
if (html.includes("SWEEP_DATA_PLACEHOLDER")) {
  html = html.replace("SWEEP_DATA_PLACEHOLDER", sweepJson);
} else {
  // Replace the existing DATA = {...} with fresh data
  // Find the line `const DATA = ` and replace to the next semicolon-newline
  const dataStart = html.indexOf("const DATA = ");
  if (dataStart > 0) {
    // Find the matching end — it's a huge JSON object followed by ;
    // Look for `;\nconst B = `
    const dataEnd = html.indexOf(";\nconst B = ", dataStart);
    if (dataEnd > 0) {
      html = html.substring(0, dataStart) + "const DATA = " + sweepJson + html.substring(dataEnd);
    }
  }
}

// 5. Replace CDN d3 script tag with inlined d3
html = html.replace(
  /<script src="https:\/\/d3js\.org\/d3\.v7\.min\.js"><\/script>/,
  `<script>${d3Js}</script>`
);

// 6. Replace sim.js external script with inlined sim
html = html.replace(
  /<script src="dist\/sim\.js"><\/script>/,
  `<script>${simJs}</script>`
);

// 7. Write output
mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", html);
const finalSize = (html.length / 1024).toFixed(0);
console.log(`\nWrote dist/index.html (${finalSize} KB) — fully self-contained`);
