"""Build a self-contained offline viewer from a Chrome complete-page snapshot.

Original files are read only. No Google app scripts, authentication configuration,
or remote stylesheets are carried into the output.
"""
import argparse
import base64
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlparse

from bs4 import BeautifulSoup, Comment
from assets import font_css, font_notices

ROOT = Path(__file__).resolve().parents[1]
# Saved Angular CSS targets this attribute; new controls need it to keep that layout.
SCOPE = "_ngcontent-ng-c945123203"
ICONS = {
    "article": '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    "docs": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 12h8M8 16h6"/>',
    "chat": '<path d="M21 14a3 3 0 0 1-3 3H8l-5 4V5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3zM7 7h10M7 11h7"/>',
    "content_copy": '<rect x="8" y="8" width="12" height="13" rx="1"/><path d="M16 8V3H3v13h5"/>',
    "cancel": '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m-6 0 6-6"/>',
    "rate_review": '<path d="M21 11v6a2 2 0 0 1-2 2H7l-4 3V5a2 2 0 0 1 2-2h9M9 14l1-4 8-8 4 4-8 8z"/>',
}


def data_url(path, mime):
    """Encode a selected local asset for embedding in the offline document."""
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def new_tag(soup, name, **attrs):
    """Create a viewer control with the saved layout's Angular styling attribute."""
    el = soup.new_tag(name, attrs=attrs)
    el[SCOPE] = ""
    return el


def sanitize(root, source_dir):
    """Remove active saved-page elements and embed assets inside the selected snapshot folder."""
    for el in list(root.select("script, iframe, object, embed, form, base, link, meta")):
        el.decompose()
    for comment in root.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()
    for el in root.find_all(True):
        for attr in list(el.attrs):
            if attr.lower().startswith("on") or attr in ("nonce", "routerlink", "data-download-url", "ng-version"):
                del el[attr]
        for attr in ("href", "xlink:href"):
            if el.has_attr(attr) and urlparse(el[attr]).scheme not in ("", "http", "https"):
                del el[attr]
        if el.name == "a" and el.get("href", "").startswith(("https://", "http://")):
            el["target"] = "_blank"
            el["rel"] = "noopener noreferrer"
        if el.has_attr("src") and not el["src"].startswith("data:"):
            raw = el["src"]
            if urlparse(raw).scheme:
                raise ValueError(f"Remote image not saved locally: {raw}")
            path = (source_dir / unquote(raw)).resolve()
            if not path.is_relative_to(source_dir.resolve()):
                raise ValueError("Asset path is outside the selected snapshot folder")
            mime = {".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif"}.get(path.suffix.lower())
            if not mime:
                raise ValueError(f"Unsupported asset: {path.name}")
            el["src"] = data_url(path, mime)


def build(source, output):
    """Validate a local saved review, rebuild its controls and write a standalone viewer."""
    source = source.resolve()
    if source == output.resolve():
        raise ValueError("The original snapshot must not be overwritten")
    raw = source.read_bytes()
    original = BeautifulSoup(raw, "lxml")
    app = original.select_one("deepreview-root")
    if not app:
        raise ValueError("This is not a supported Deep Review snapshot")
    # Reject incomplete page/comment links before changing the saved markup.
    pdf_pages = app.select("[data-pdf-page-wrapper]")
    cards = app.select("[data-margin-card-id]")
    boxes = app.select(".pdf-bbox-highlight")
    ids = [c["data-margin-card-id"] for c in cards]
    if not pdf_pages or not cards or len(ids) != len(set(ids)):
        raise ValueError("Missing pages/comments, or duplicate comment IDs")
    linked = {box.get("data-comment-id") for box in boxes}
    if linked != set(ids):
        raise ValueError(f"Incomplete comment/highlight links: {set(ids) ^ linked}")
    numbers = [int(page["data-page-number"]) for page in pdf_pages]
    if numbers != list(range(1, len(pdf_pages) + 1)):
        raise ValueError("Saved page numbers are not consecutive")
    # Compare these body hashes after rebuilding to catch accidental text loss.
    body_fingerprints = [sha256(c.select_one(".comment-body").get_text().encode()).hexdigest() for c in cards]
    document_name = app.select_one(".review-viewer-header-title").get_text(strip=True)
    version_node = app.select_one(".review-version-switcher")
    version = version_node.get_text(" ", strip=True) if version_node else ""
    doc_id = app.select_one(".doc-id-pill code").get_text(strip=True)
    metadata = {
        "schemaVersion": 1, "documentId": doc_id, "documentName": document_name,
        "versionLabel": version, "sourceUrl": f"https://research.google/deepreview/documents/{doc_id}",
        "sourceSha256": sha256(raw).hexdigest(), "pageCount": len(pdf_pages),
        "commentCount": len(cards), "highlightCount": len(boxes),
        "reportSource": "same-snapshot-comment-bodies", "commentIds": ids,
    }
    # Reuse saved layout CSS, then replace web fonts with licensed embedded fonts.
    styles = []
    for style in original.find_all("style"):
        css = re.sub(r"@font-face\s*\{[^}]*\}", "", style.get_text())
        # URL-bearing stylesheet attributes never enter the new document.
        if re.search(r"url\(\s*['\"]?(?:https?:|//|\./)", css, re.I):
            raise ValueError("A remote CSS resource needs embedding")
        styles.append(css)
    # Replace online-only navigation and Angular controls with offline equivalents.
    for el in list(app.select(".deepreview-header, .landing-link, .review-version-switcher, .review-feedback-btn")):
        el.decompose()
    for actions in list(app.select(".manuscript-top-actions")):
        if not actions.find(True):
            actions.decompose()
    sanitize(app, source.parent)
    for icon in list(app.select("mat-icon")):
        name = icon.get_text(strip=True)
        svg = original.new_tag("svg", attrs={**icon.attrs, "viewBox": "0 0 24 24", "fill": "none", "stroke": "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "data-icon": name})
        for node in list(BeautifulSoup(ICONS.get(name, ICONS["article"]), "html.parser").contents):
            svg.append(node)
        icon.replace_with(svg)
    for select in list(app.select("mat-select")):
        if select.get_text(" ", strip=True) == "All Types":
            field = select.find_parent("mat-form-field")
            native = new_tag(original, "select", id="severity-filter", **{"aria-label": "Filter comment types"})
            for value, label in (("ALL", "All Types"), ("critical", "Critical"), ("major", "Major"), ("minor", "Minor"), ("suggestion", "Suggestion")):
                option = original.new_tag("option", attrs={"value": value}); option.string = label; native.append(option)
            field.replace_with(native)
    for el in list(app.select("router-outlet, .review-viewer-page > .sr-only")):
        el.decompose()
    # Stable pane IDs are the shared contract used by viewer.js for focus and scrolling.
    panel = app.select_one(".feedback-stream-pane")
    panel["id"] = "feedback-pane"
    panel["aria-label"] = "Review feedback"
    pdf = app.select_one(".pdf-manuscript-viewport")
    pdf["id"] = "pdf-pane"
    comments = new_tag(original, "div", id="comments-view", **{"class": "offline-comments-view"})
    for child in list(panel.contents):
        comments.append(child.extract())
    panel.append(comments)
    restore = new_tag(original, "button", id="restore-dismissed", type="button", hidden="")
    restore.string = "Restore dismissed"
    comments.insert(0, restore)
    summary = comments.select_one(".overall-summary-body")
    summary["id"] = "overall-summary-body"
    read_button = comments.select_one(".read-more-btn")
    read_button["aria-controls"] = "overall-summary-body"
    read_button["aria-expanded"] = str("collapsed" not in summary.get("class", [])).lower()
    for card in cards:
        cid = card["data-margin-card-id"]
        card["id"] = f"comment-{cid}"
        card["data-severity"] = card.select_one(".severity-badge").get_text(strip=True).lower()
        card["aria-label"] = card.select_one(".comment-summary").get_text(" ", strip=True)
    for box in boxes:
        cid = box["data-comment-id"]
        card = cards[ids.index(cid)]
        box["tabindex"] = "0"; box["role"] = "button"; box["aria-pressed"] = "false"
        box["aria-controls"] = card["id"]
        box["aria-label"] = f"{card['data-severity'].title()}: {card['aria-label']}"
    # Both modes reuse the same captured bodies, rather than mixing separate exports.
    report = new_tag(original, "article", id="report-view", hidden="", **{"class": "offline-report-view", "aria-label": "Full review report"})
    report_summary = new_tag(original, "section", **{"class": "offline-report-summary", "tabindex": "0"})
    heading = new_tag(original, "h2"); heading.string = "Overall Feedback"; report_summary.append(heading)
    for child in summary.contents:
        report_summary.append(deepcopy(child))
    report.append(report_summary)
    heading = new_tag(original, "h2"); heading.string = "Detailed Feedback"; report.append(heading)
    for card in cards:
        section = new_tag(original, "section", **{"class": "offline-report-section", "data-report-comment-id": card["data-margin-card-id"], "tabindex": "0"})
        top = deepcopy(card.select_one(".figma-card-top")); section.append(top)
        section.append(deepcopy(card.select_one(".comment-body")))
        section.append(deepcopy(card.select_one(".comment-location-footer")))
        report.append(section)
    panel.append(report)
    status = new_tag(original, "div", id="offline-status", role="status", **{"aria-live": "polite", "class": "sr-only"})
    app.append(status)
    document = BeautifulSoup("<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title></title></head><body></body></html>", "lxml")
    document.title.string = f"Deep Review — {document_name} (Offline)"
    # Authorize only the bundled runtime and block automatic external resources.
    runtime = (ROOT / "viewer" / "viewer.js").read_text(encoding="utf-8")
    script_hash = base64.b64encode(sha256(runtime.encode()).digest()).decode()
    csp = document.new_tag("meta", attrs={"http-equiv": "Content-Security-Policy", "content": f"default-src 'none'; script-src 'sha256-{script_hash}'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"})
    document.head.insert(1, csp)
    style = document.new_tag("style")
    style.string = "\n".join(styles) + "\n" + font_css() + "\n" + (ROOT / "viewer" / "viewer.css").read_text(encoding="utf-8")
    document.head.append(style)
    license_text = font_notices()
    document.head.append(Comment("Embedded font licenses:\n" + license_text))
    document.body.append(app.extract())
    manifest = document.new_tag("script", attrs={"id": "snapshot-manifest", "type": "application/json"})
    manifest.string = json.dumps(metadata, ensure_ascii=False).replace("<", "\\u003c")
    document.body.append(manifest)
    script = document.new_tag("script"); script.string = runtime; document.body.append(script)
    # Check content preservation and resource embedding before writing any output.
    after = [sha256(c.select_one(".comment-body").get_text().encode()).hexdigest() for c in document.select("[data-margin-card-id]")]
    if after != body_fingerprints:
        raise ValueError("Comment text changed while building")
    if any(not e["src"].startswith("data:") for e in document.select("[src]")):
        raise ValueError("Unembedded resource in output")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(str(document), encoding="utf-8", newline="\n")
    print(json.dumps({**metadata, "output": str(output.resolve()), "outputBytes": output.stat().st_size, "commentTextVerified": True}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Path to your local Chrome complete-page HTML; keep it outside the repository")
    parser.add_argument("--output", type=Path, default=ROOT / "output" / "deep-review-offline.html")
    args = parser.parse_args()
    build(args.source, args.output)
