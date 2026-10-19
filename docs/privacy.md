# Data handling

Applies to version 1.0.2. This describes the implementation, not Google authorization.

The exporter processes the selected review's page pixels, overall feedback, comments, severity/page labels and highlight geometry. It includes document/review identifiers, name, cleaned source URL and export time in the HTML for offline reading and source identification.

It does not read passwords, cookies, authentication tokens, site storage or full browsing history. Captured reviews are not uploaded to a developer server or analytics service. Mode/filter/scroll events may cause the original site to make its own requests. Permissions: `activeTab`, `scripting`, `downloads`. Download queries and cancellation use the job's own ID.

## Sanitization is not anonymization

- Rich text/formulas use tag, attribute and CSS-property allowlists. Scripts, events, arbitrary hidden attributes, `ping`, frames and remote display resources are removed.
- Reference links keep HTTP(S) destinations without usernames/passwords, queries or fragments. Query-based links may change or stop working. A URL written as visible review text is still content, not an attribute to redact.
- Source document URLs are handled separately: unnecessary queries/hash values are removed, with `paperId` retained for the root document route when needed.
- URL paths, identifiers, formulas, text and page pixels may identify people or contain confidential information. No automatic anonymization or encryption is provided. Inspect exports before sharing.
- Saved-file CSP blocks automatic external connections and allows only its bundled script. Users can deliberately navigate to cleaned reference links.

Job data lives in browser memory and a temporary Blob. The Blob is released after download completion, cancellation or creation failure. Cancel is remembered while an ID is pending; only this job's completed file can be removed if completion wins that race. Cleanup errors are reported. Saved files and Chrome download records may remain until the user removes them; uninstalling does not erase them.

Viewer selection, language, zoom and dismissal are session-only. Nothing is synchronized to an account. Sharing a saved HTML shares its full contents.

Publisher: hcscat. Use repository Issues with fictional examples. The previously approved public contact remains in the [Korean policy](../store/privacy-policy.ko.html). GitHub applies its own policies to visits, downloads and issues. Web Store submission and GitHub Pages hosting are not part of this GitHub-only release workflow.
