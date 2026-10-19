# 1.0.2 local release verification

Verification date: 2026-10-19. GitHub push, tag/release publication, Pages deployment and Chrome Web Store submission are not part of local verification.

- TypeScript, formatting, Python syntax, npm dependency audit, source/private-sentinel checks and independent exact-index/package secret scans are required.
- Two fictional documents exercise actual extension capture, transfer, render and Chrome download completion: each has 3 pages, 12 comments and 12 highlights. Original Report/filter/scroll state is restored. Broken links and unsupported source pages are rejected.
- Each output exercises 13 offline viewer groups: resources/fonts, expand/collapse, views, every card/rectangle link, pointer/keyboard focus, filtering/dismissal, zoom 50/100/200/500, full copy payload, layouts, no HTTP/errors, and English/Korean labels without changing review content.
- Security regressions check URL credentials/query/fragment removal, hidden/event/resource attribute removal, safe formula MathML/SVG/style/copy metadata, idempotence, unsafe schemes and source URL boundaries.
- Cancellation is paused during resource loading, before ID delivery and after file completion before ID delivery; cleanup failure is forced. Exceptions, late success, file removal and unrelated IDs are checked.
- Real isolated Chrome language profiles use Korean and `--lang=en-US` to verify both native task interfaces. The same security/cancellation suite runs in each.
- README screenshots are captured from the synthetic extension output in English/Korean. PNG dimensions/metadata and rendered pixels are reviewed. ZIP bytes, package versions, local links and release checksums are compared.

Artifacts stay in ignored `output/`. The public tests do not use an authenticated Google account. Test copies alone have a fixture-origin host permission; production permissions remain activeTab/scripting/downloads with no host permissions. Physical toolbar activation on the current live Google UI is outside this automated run. Clipboard content is stubbed; the OS clipboard is unchanged. No rate-limit, access-control bypass or account-blocking tests are performed.

Reproduction scripts: `verify_extension.js`, `verify_security.js`, `verify_viewer.js`, `capture_readme_screenshots.js`, `verify_store_assets.py`, `audit_public_source.py`, `prepare_release.py`. See the development guide for commands and local logs for the exact run results.
