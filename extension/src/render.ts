/** Turn validated review data into a complete offline document using packaged assets. */
import { cleanHtml, validateSnapshot, type Snapshot } from "./snapshot";
import { language } from "./i18n";

/** Packaged styles, runtime and font notices to embed in the standalone viewer. */
export interface ViewerAssets {
  css: string;
  runtime: string;
  fontNotices: string;
}
// Escape plain titles, IDs and attribute values instead of treating them as HTML.
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
// Icons are authored SVG fragments, selected locally rather than copied from the source.
const icon = (kind: string) =>
  `<svg class="mat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    {
      docs: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 12h8M8 16h6"/>',
      article:
        '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
      chat: '<path d="M21 14a3 3 0 0 1-3 3H8l-5 4V5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3zM7 7h10M7 11h7"/>',
      copy: '<rect x="8" y="8" width="12" height="13" rx="1"/><path d="M16 8V3H3v13h5"/>',
      cancel: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m-6 0 6-6"/>',
    }[kind] || ""
  }</svg>`;
// All caller-provided classes/extra attributes come from fixed templates below.
const button = (classes: string, label: string, extra = "", glyph = "") =>
  `<button type="button" class="mdc-button mat-mdc-button-base mdc-button--outlined mat-mdc-outlined-button mat-unthemed ${classes}" ${extra}>${glyph ? icon(glyph) : ""}<span class="mdc-button__label">${escape(label)}</span></button>`;

/** Build a sanitized standalone document with the structure expected by viewer.js. */
export async function renderSnapshot(
  snapshot: Snapshot,
  assets: ViewerAssets,
): Promise<string> {
  validateSnapshot(snapshot);
  const s = {
    ...snapshot,
    overallHtml: cleanHtml(snapshot.overallHtml),
    comments: snapshot.comments.map((c) => ({
      ...c,
      bodyHtml: cleanHtml(c.bodyHtml),
    })),
  };
  // Allow only this exact script hash and block automatic external connections.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(assets.runtime),
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
  // Look up each highlight's comment title and severity by its stable ID.
  const byId = new Map(s.comments.map((c) => [c.id, c]));
  const top = (c: (typeof s.comments)[number]) =>
    `<div class="figma-card-top comment-card-header"><div class="header-title-row"><span class="severity-badge severity-${c.severity}">${escape(c.severity[0].toUpperCase() + c.severity.slice(1))}</span><h3 class="comment-summary">${escape(c.title)}</h3></div></div>`;
  const pages = s.pages
    .map(
      (p) =>
        `<div class="pdf-page-wrapper annotated-pdf-page" data-page-number="${p.number}" data-pdf-page-wrapper="${p.number}"><img class="annotated-pdf-page-img" alt="Page ${p.number}" src="${escape(p.src)}">${p.highlights.map((h) => `<div class="pdf-bbox-highlight severity-${byId.get(h.commentId)!.severity}" data-comment-id="${escape(h.commentId)}" style="left:${h.left}%;top:${h.top}%;width:${h.width}%;height:${h.height}%" tabindex="0" role="button" aria-pressed="false" aria-controls="comment-${escape(h.commentId)}" aria-label="${escape(byId.get(h.commentId)!.title)}"></div>`).join("")}</div>`,
    )
    .join("");
  const cards = s.comments
    .map(
      (c) =>
        `<div class="figma-feedback-card margin-comment-card anchored-comment-card" id="comment-${escape(c.id)}" data-margin-card-id="${escape(c.id)}" data-severity="${c.severity}" role="listitem" tabindex="0" aria-label="${escape(c.title)}">${top(c)}<div class="comment-body">${c.bodyHtml}</div><div class="figma-card-footer"><div class="figma-footer-left"><span class="comment-location-footer figma-page-line-label location-badge">${escape(c.location)}</span></div><div class="figma-footer-actions">${button("figma-dismiss-btn", "Dismiss", "", "cancel")}</div></div></div>`,
    )
    .join("");
  // Build Report from the same snapshot so it cannot mix different review versions.
  const report = `<article id="report-view" class="offline-report-view" hidden aria-label="Full review report"><section class="offline-report-summary" tabindex="0"><h2>Overall Feedback</h2>${s.overallHtml}</section><h2>Detailed Feedback</h2>${s.comments.map((c) => `<section class="offline-report-section" data-report-comment-id="${escape(c.id)}" tabindex="0">${top(c)}<div class="comment-body">${c.bodyHtml}</div><span class="comment-location-footer">${escape(c.location)}</span></section>`).join("")}</article>`;
  // Preserve provenance and validation counts in inert JSON, not executable app state.
  const manifest = {
    ...s.metadata,
    schemaVersion: 1,
    pageCount: s.pages.length,
    commentCount: s.comments.length,
    highlightCount: s.pages.reduce((n, p) => n + p.highlights.length, 0),
    commentIds: s.comments.map((c) => c.id),
    reportSource: "same-snapshot-comment-bodies",
    diagnostics: s.diagnostics,
  };
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deep Review — ${escape(s.metadata.documentName)} (Offline)</title><style>${assets.css.replace(/<\/style/gi, "<\\/style")}</style><!-- ${assets.fontNotices.replace(/--/g, "—")} --></head><body><deepreview-root><div class="deepreview-layout"><main class="deepreview-main"><deepreview-review-viewer><div class="review-viewer-header"><div class="review-viewer-header-container"><h1 class="review-viewer-header-title" id="viewer-heading">${escape(s.metadata.documentName)}</h1><div class="review-viewer-header-fill"></div><div class="manuscript-top-actions"><div class="pdf-zoom-controls" role="group" aria-label="PDF zoom controls"><button type="button" class="zoom-step-btn" aria-label="Zoom out PDF">−</button><button type="button" class="zoom-reset-btn" aria-label="Reset PDF zoom to 100%">100%</button><button type="button" class="zoom-step-btn" aria-label="Zoom in PDF">+</button></div>${button("view-mode-toggle-btn", "View as Report", 'aria-pressed="false"', "article")}${button("copy-report-btn", "Copy Report", "", "copy")}<span class="sr-only copy-report-status" role="status" aria-live="polite"></span></div></div></div><div class="review-viewer-page"><div class="figma-split-workspace split-review-workspace" style="--pat-pdf-width:640px;--pat-comment-width:540px;--pat-comment-scale:1;--pat-manuscript-scale:1"><div class="figma-manuscript-column"><div class="pdf-manuscript-viewport pdf-scroll-pane annotated-pdf-viewer" id="pdf-pane" tabindex="0" aria-label="Annotated PDF document"><div class="pdf-pages-stack">${pages}</div></div></div><div class="feedback-stream-pane comments-scroll-pane anchored-comments-section" id="feedback-pane" aria-label="Review feedback"><div id="comments-view" class="offline-comments-view"><button id="restore-dismissed" type="button" hidden>Restore dismissed</button><div class="overall-card-title-row"><div class="header-title-row">${icon("docs")}<h2 class="overall-card-heading">Overall Feedback</h2></div></div><div class="figma-feedback-card overall-stream-card overall-summary-card margin-comment-card selected" tabindex="0"><div class="comment-body overall-summary-body${s.summaryExpanded ? "" : " collapsed"}" id="overall-summary-body">${s.overallHtml}</div><div class="figma-card-footer overall-card-footer">${button("read-more-btn", s.summaryExpanded ? "Read less" : "Read more", `aria-controls="overall-summary-body" aria-expanded="${s.summaryExpanded}"`)}<div class="figma-footer-actions">${button("figma-dismiss-btn", "Dismiss", "", "cancel")}</div></div></div><div class="detailed-feedback-toolbar"><div class="detailed-feedback-title-group">${icon("chat")}<h2 class="detailed-feedback-badge">Detailed Feedback</h2></div><select id="severity-filter" aria-label="Filter comment types"><option value="ALL">All Types</option>${["critical", "major", "minor", "suggestion"].map((t) => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join("")}</select></div><div class="detailed-feedback-list comments-cards-stack" role="list">${cards}</div></div>${report}</div></div></div><div id="offline-status" class="sr-only" role="status" aria-live="polite"></div></deepreview-review-viewer></main></div></deepreview-root><script type="application/json" id="snapshot-manifest">${JSON.stringify(manifest).replace(/</g, "\\u003c")}</script><script>${assets.runtime}</script></body></html>`;
}

/** Create a safe download filename from the document name and available version. */
export function downloadName(s: Snapshot): string {
  const base =
    s.metadata.documentName
      .replace(/\.pdf$/i, "")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/[. ]+$/g, "")
      .slice(0, 110) || "review";
  const version = s.metadata.versionLabel.match(/\d+/)?.[0];
  return `DeepReview/${base}-deep-review${version ? `-v${version}` : ""}.html`;
}
