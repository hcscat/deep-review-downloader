# Changelog

## 1.0.2 — local release candidate

- Replace HTML attribute blacklisting with rich-text/formula tag, attribute and CSS allowlists. Remove reference URL credentials, queries and fragments; document that this is not content anonymization.
- Make capture-port cleanup idempotent and remember cancellation while Chrome creates a download. Cancel late IDs and remove only the job's completed file if completion wins the cancellation race. Report cleanup failures.
- Add English fallback and Korean extension messages, plus an offline viewer language selector. Review content stays in its original language.
- Add English/Korean READMEs, fictional-document screenshots and a local GitHub-only release preparation/checksum workflow. Chrome Web Store submission is on hold.

This version has not been published by the preparation scripts. Verification results and remaining limits are recorded in `docs/release-verification.md`.
