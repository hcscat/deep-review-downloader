# Security fixes in 1.0.2

[한국어](security-changes.ko.md)

The examples below show the relevant excerpts, with unrelated code omitted. All example values are fictional. These changes reduce copied metadata and make cancellation reliable; they do not anonymize the paper/review itself.

## 1. Copy formatting, not arbitrary page attributes

Before, `cleanHtml` removed a list of known bad attributes. Other attributes and HTTP(S) reference queries passed through:

```ts
if (name.startsWith("on") || ["id", "nonce", "srcset", "srcdoc", "formaction", "routerlink"].includes(name))
  el.removeAttribute(attr.name);
if ((name === "href" || name === "xlink:href") && !/^(https?:\/\/|#)/i.test(attr.value))
  el.removeAttribute(attr.name);
```

After, every attribute starts as unapproved, and only explicit rich-text/formula cases survive. Active tags are removed; unknown wrappers are unwrapped. The inert template is never inserted into the live page.

```ts
let keep = false;
// Explicit checks for class, safe CSS, formula attributes, local images, etc.
if (!keep) el.removeAttribute(attr.name);
```

Reference destinations are cleaned separately:

```ts
const url = new URL(raw);
if (!["https:", "http:"].includes(url.protocol)) return;
url.username = "";
url.password = "";
url.search = "";
url.hash = "";
return url.href;
```

An example link to `https://reference.invalid/paper?token=example#section`, with `ping` and an arbitrary hidden attribute, becomes an ordinary link to `https://reference.invalid/paper`. Mathematical text, MathML, SVG text and the explicit formula-copy attributes remain supported. Credentials and nonstandard ports in source-page URLs are rejected.

Removing queries can break search/download/query-based reference links. Source document URLs have a different rule: keep the document identifier needed to identify the source. Paths, visible text and page pixels are not redacted. Documentation now makes those limits explicit.

## 2. Remember Cancel while Chrome creates a download

Before, capture completion disconnected `port`, but the Cancel handler still tried to post through it. An exception could prevent UI cleanup, and a pending download ID could arrive after cancellation.

```ts
finished = true;
port?.postMessage({ type: "cancel" });
port?.disconnect();
// Later:
downloadId = await chrome.downloads.download(options);
```

After, cleanup takes and clears the port reference once; disconnecting aborts the source collector. Cancellation intent is stored separately from terminal UI state.

```ts
const active = port;
port = undefined;
try { active?.disconnect(); } catch { /* already disconnected */ }
```

After the awaited download creation returns, the code checks terminal state again:

```ts
if (finished) {
  try { await discardDownload(downloadId); }
  catch (error) { if (cancelRequested) cancellationFailed(error); }
  return;
}
```

Only this job's ID is canceled. If its file already completed during the race, that file alone is removed. Cleanup failures are displayed rather than claiming that removal succeeded. Blob lifetime and late success callbacks follow the same terminal-state boundary.

Regression tests pause during packaged-resource loading, before ID assignment, and after file completion but before ID delivery. They also force a cleanup failure and check that no other download ID is touched.
