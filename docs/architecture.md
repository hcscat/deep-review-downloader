# Architecture and data boundaries

User action → service worker opens an extension task → isolated capture script → validated Snapshot → local renderer → job-specific Chrome download → self-contained offline HTML.

The worker does not retain the large body. The source tab and task page exchange ordered chunks directly, with length/SHA-256 checks. The task page owns the Blob and tracks only its download ID. Success requires a confirmed complete download.

Capture checks document/review identity, page continuity, unique comment IDs, two-way highlight links and percentage geometry. It restores temporary source mode/filter/scroll/focus changes in finally. Already dismissed content can be absent, and a missing source total limits completeness claims.

Formatting uses tag/attribute/CSS allowlists in an inert template. Reference HTTP(S) URLs lose username/password/query/fragment values. Source URLs follow a separate rule retaining the needed document ID. Paths, text, formulas and pixels are not automatically anonymized. Authentication cookies, tokens, passwords and site storage are not read.

Port cleanup is idempotent. Cancellation intent survives asynchronous resource loading and download creation. A late ID is canceled; only this job's file may be removed if it completed during cancellation. Cleanup failures are displayed and Blob resources are released. Closing the task tab during download creation is not the same as pressing Cancel.

Extension pages restrict connections to packaged resources. Output CSP allows only the exact bundled script hash, inline authored styles and data images/fonts; background connections, frames and forms are blocked. Users can deliberately open cleaned reference links.

English fallback and Korean extension strings are bundled. Chrome display language chooses the task UI. The offline viewer switches English/Korean in memory; review text is unchanged. Other selection/zoom/dismissal/scroll state is session-only. No storage, account sync or telemetry is used.

PDF pages are images. Public fixtures/screenshots are fictional. Actual source documents, downloads, Chrome profiles and private audit output are excluded. Distribution uses GitHub Releases only; preparation scripts perform no external publication.
