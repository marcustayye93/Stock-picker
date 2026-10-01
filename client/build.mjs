// Standalone client bundler (replaces the Hatch SDK's buildClient).
// Bundles `client/index.html` to `./dist/` (served by server.ts).
// Must run under Bun.

import { rm } from "node:fs/promises";
import { basename } from "node:path";
import tailwindPlugin from "bun-plugin-tailwind";

const ENTRY = "./client/index.html";
const OUTDIR = "./dist";

if (typeof Bun === "undefined" || typeof Bun.build !== "function") {
  throw new Error("client/build.mjs must run under Bun");
}

await rm(OUTDIR, { force: true, recursive: true });

const result = await Bun.build({
  entrypoints: [ENTRY],
  outdir: OUTDIR,
  minify: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  naming: {
    asset: "assets/[name]-[hash].[ext]",
    chunk: "assets/[name]-[hash].[ext]",
    entry: "[name].[ext]",
  },
  plugins: [tailwindPlugin],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  throw new Error("client build failed; see logged diagnostics");
}

// Bun writes imported assets to `naming.asset` (`assets/<name>-<hash>.<ext>`)
// but emits the JS/CSS import URL as a bare `./<name>-<hash>.<ext>` — without
// the `assets/` directory prefix. Re-prefix only the bare imported-asset URLs
// to `./assets/...` so the browser resolves them correctly.
const assetFiles = result.outputs
  .filter((output) => output.kind === "asset")
  .map((output) => basename(output.path));

if (assetFiles.length > 0) {
  for (const output of result.outputs) {
    if (!/\.(js|css|html)$/.test(output.path)) {
      continue;
    }
    let text = await output.text();
    let changed = false;
    for (const name of assetFiles) {
      const bare = `./${name}`;
      if (text.includes(bare)) {
        text = text.split(bare).join(`./assets/${name}`);
        changed = true;
      }
    }
    if (changed) {
      await Bun.write(output.path, text);
    }
  }
}

console.log(`client build ok -> ${OUTDIR}`);
