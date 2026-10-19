# Pre-publication review

Current candidate: 1.0.2. GitHub-only distribution; Chrome Web Store is on hold. No source upload or release publication is performed by this repository's scripts.

Public content is limited to extension/viewer source, authored documentation, licensed fonts, synthetic fixtures/tests, generated fictional screenshots and earlier store reference artwork. Real documents, review bodies/IDs, authenticated browser state, keys/tokens, machine paths, IP/MAC addresses and private audit artifacts are excluded.

Run `npm run audit:source` with optional private sentinels from a file outside the repository. It reports locations and rule names, never matched values. IP, machine-path, analytics/client-ID and image metadata checks complement token/email/real-document-ID checks. Loopback test addresses are allowed; actual public/private network addresses are not publication data. Image pixels still need visual review.

Then review the exact Git index and extract only the release ZIP for independent Gitleaks scans with `--redact=100`. Confirm staged bytes match reviewed files; inspect all PNG pixels, third-party notices, public links, version numbers and ZIP contents. User-approved public publisher/contact and upstream license attribution are intentional disclosures. Pattern scans do not prove that every possible sensitive string is absent.

No software reuse license has been chosen; do not describe the project as open source until that decision is made. Final publishing requires the publisher's approval of the reviewed commit/assets. See `docs/releasing.md`.
