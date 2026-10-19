# Install and update

[한국어](chrome-extension-install.md) · [README](../README.md)

1. Download the extension ZIP from [GitHub Releases](https://github.com/hcscat/deep-review-downloader/releases), not the automatic source-code archive.
2. Extract it into a folder you will keep. It must contain `manifest.json`, `background.js`, `export.html` and `_locales/`.
3. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked** and select that folder. Organization policies may restrict unpacked extensions; this project does not bypass them.
4. Pin **Deep Review HTML Exporter** in Chrome's extensions menu.
5. Sign in to Deep Review yourself, open a review and wait for it to load. Click the exporter once. Keep the source tab, document and version unchanged during capture.
6. Wait for **HTML file saved** and ✓. The default location is `DeepReview/` inside Chrome's download directory. Chrome may show a Save dialog depending on settings. Existing files are not overwritten.

The extension follows Chrome's display language: English fallback, Korean when Chrome uses Korean. The saved HTML has its own language selector and needs no extension to open. Interface labels change; review content is never translated.

**Cancel** stops capture or cancels this job's download. If it completed before cancellation was acknowledged, only this job's completed file is removed. Cleanup failures tell you to check Chrome Downloads. Other downloads are never canceled or removed. Closing the task tab is not a substitute for Cancel while a download is being created.

To update, finish or cancel any export, replace the installed folder with the new release, click **Reload** on the extension card and refresh the source review tab. Unpacked extensions do not automatically update from GitHub. Keep the installed folder. Removing the extension does not remove saved HTML files. Release installation needs neither Node.js nor Python.

## Verify on Windows

```powershell
Get-FileHash -Algorithm SHA256 .\deep-review-html-exporter-v<version>.zip
```

Compare `Hash` with the matching filename in `SHA256SUMS.txt`. A match verifies the bytes listed by that release, not an independent audit. If they differ, download again before installing.

## Troubleshooting

- **Permission error:** refresh the source review and click the toolbar button in that tab. Opening an internal export page directly does not grant `activeTab`.
- **Missing page/link:** wait for loading, show All Types and retry. Inconsistent snapshots are rejected.
- **Restricted image:** browser canvas restrictions can prevent capture. Do not disable browser security.
- **No download:** read the task-page error and check Chrome Downloads.

Distribution is GitHub Releases only; Web Store publication is on hold. [Privacy and limits](privacy.md).
