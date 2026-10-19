/** Test-only entry point: never included in the production ZIP allowlist. */
import { build } from "esbuild";
await build({
  stdin: {
    contents:
      'import {cleanHtml,cleanReferenceUrl,supportedUrl} from "./extension/src/snapshot"; globalThis.__reviewAudit={cleanHtml,cleanReferenceUrl,supportedUrl};',
    resolveDir: process.cwd(),
  },
  outfile: "output/playwright/extension-test/security-probe.js",
  bundle: true,
  format: "iife",
  target: "chrome120",
});
