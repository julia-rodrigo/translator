// Bundles src/ into docs/ (served by GitHub Pages and packaged into the Android app).
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("docs", { recursive: true, force: true });
await mkdir("docs");
await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2020",
  outfile: "docs/app.js",
});
await cp("src/index.html", "docs/index.html");
await cp("src/style.css", "docs/style.css");
await cp("src/icon.png", "docs/icon.png");
console.log("Built docs/");
