/** Bundle without reading local papers, accounts or test profiles. */
import { build } from "esbuild";
import { mkdir, readFile, writeFile, copyFile, cp } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Script-relative paths let clean clones build on another computer unchanged.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "deep-review-extension");
await mkdir(out, { recursive: true });
for (const name of ["manifest.json", "export.html", "export.css"]) {
  await copyFile(
    path.join(root, "extension/static", name),
    path.join(out, name),
  );
}
await cp(
  path.join(root, "extension/static/_locales"),
  path.join(out, "_locales"),
  { recursive: true },
);
await build({
  entryPoints: {
    background: "extension/src/background.ts",
    export: "extension/src/export.ts",
  },
  outdir: out,
  bundle: true,
  format: "esm",
  target: "chrome120",
  legalComments: "none",
  absWorkingDir: root,
});
// chrome.scripting injects a classic isolated-world script, not an ES module.
await build({
  entryPoints: ["extension/src/capture.ts"],
  outfile: path.join(out, "capture.js"),
  bundle: true,
  format: "iife",
  target: "chrome120",
  legalComments: "none",
  absWorkingDir: root,
});
await copyFile(
  path.join(root, "viewer/viewer.js"),
  path.join(out, "viewer-runtime.js"),
);
execFileSync("python", ["scripts/build_extension_assets.py", out], {
  cwd: root,
  stdio: "inherit",
});
await copyFile(
  path.join(root, "docs/chrome-extension-install.md"),
  path.join(out, "INSTALL-ko.md"),
);
await copyFile(
  path.join(root, "docs/install.md"),
  path.join(out, "INSTALL.md"),
);

// An allowlist prevents incidental downloads or stale build files from shipping.
const files = [
  "background.js",
  "capture.js",
  "export.css",
  "export.html",
  "export.js",
  "manifest.json",
  "viewer-runtime.js",
  "viewer.css",
  "THIRD_PARTY_NOTICES.txt",
  "INSTALL-ko.md",
  "INSTALL.md",
  "_locales/en/messages.json",
  "_locales/ko/messages.json",
  ...[16, 32, 48, 128].map((size) => `icons/${size}.png`),
];
// Fixed ZIP timestamps avoid leaking build times and make identical builds reproducible.
execFileSync(
  "python",
  [
    "-c",
    `from pathlib import Path
from zipfile import ZipFile,ZipInfo,ZIP_DEFLATED
import json
folder=Path(${JSON.stringify(out)})
with ZipFile(folder.parent/'deep-review-extension.zip','w',ZIP_DEFLATED) as archive:
 for name in json.loads(${JSON.stringify(JSON.stringify(files))}):
  info=ZipInfo(name,date_time=(2020,1,1,0,0,0))
  info.compress_type=ZIP_DEFLATED
  info.external_attr=0o644<<16
  archive.writestr(info,(folder/name).read_bytes())
`,
  ],
  { cwd: root, stdio: "inherit" },
);
const manifest = JSON.parse(
  await readFile(path.join(out, "manifest.json"), "utf8"),
);
await writeFile(
  path.join(root, "dist", "extension-build.json"),
  JSON.stringify(
    {
      version: manifest.version,
      folder: "dist/deep-review-extension",
      permissions: manifest.permissions,
      hostPermissions: manifest.host_permissions || [],
      archive: "dist/deep-review-extension.zip",
    },
    null,
    2,
  ) + "\n",
);
console.log(`Extension ready: ${out}`);
