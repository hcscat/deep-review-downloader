# GitHub-only releases

[한국어](releasing.ko.md)

Chrome Web Store publication is on hold. There is no automatic publishing workflow. These steps are a checklist, not an instruction to upload before the publisher approves it.

1. Update the manifest, package/lockfile versions, changelog and privacy description together.
2. Run typecheck, formatting, build, security/cancellation regressions, synthetic extension capture, offline viewer checks in both languages and screenshot validation. See [development](chrome-extension-development.md).
3. Run `npm run audit:source`, independent redacted secret scans of the exact Git index and extracted release package, and manual text/image review. Keep real papers, IDs, account/profile data, machine paths, IP addresses and private audit logs outside publication files. Explicitly approved public publisher/contact and upstream font notices are intentional disclosures.
4. Run `npm run release:prepare`. It builds and creates `dist/release/deep-review-html-exporter-v<version>.zip` and `SHA256SUMS.txt`. Verify these exact bytes before upload. Do not upload the whole `dist/` or `output/` folder.
5. Review `git diff --cached` and `git diff`, image pixels and local links. Approve the final public content before committing/pushing. Do not include private exports in issues, release notes or attachments.
6. After approval, commit/push the reviewed source to the intended repository. In GitHub **Releases → Draft a new release**, choose a tag such as `v1.0.2` pointing to that reviewed commit. Use the matching changelog as the description.
7. Upload only the versioned extension ZIP and matching checksums. Check the draft's files and version before publishing. A draft/tag/upload is an external action and requires publisher authorization.
8. Download the published asset, verify its hash and install it in a fresh Chrome profile. Verify the README images and links on GitHub. Only then call the release published and verified.

Unpacked extensions require manual updates; this does not set up Chrome auto-update or change browser security settings. Installation is documented in [English](install.md) and [Korean](chrome-extension-install.md).

Reference: [GitHub release management](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).
