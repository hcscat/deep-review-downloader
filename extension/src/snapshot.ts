/** Define the capture format and enforce the data, URL and markup boundaries. */
import { m } from "./i18n";
/** Percentage geometry stays aligned at any zoom; commentId links to its feedback. */
export interface Highlight {
  commentId: string;
  left: number;
  top: number;
  width: number;
  height: number;
}
/** Transfer embedded page pixels and dimensions instead of authenticated image URLs. */
export interface PageImage {
  number: number;
  src: string;
  width: number;
  height: number;
  highlights: Highlight[];
}
/** One review body; id is the shared key used by cards and page highlights. */
export interface ReviewComment {
  id: string;
  severity: string;
  title: string;
  bodyHtml: string;
  location: string;
}
/** Serializable contract shared by the source collector and the local renderer. */
export interface Snapshot {
  schemaVersion: 1;
  // These source identifiers are intentional output data, not anonymized metadata.
  metadata: {
    documentId: string;
    documentName: string;
    versionLabel: string;
    sourceUrl: string;
    capturedAt: string;
    reviewIdentity: string;
  };
  overallHtml: string;
  summaryExpanded: boolean;
  pages: PageImage[];
  comments: ReviewComment[];
  diagnostics: string[];
}
// Use a fixed port name to distinguish this capture protocol from other messages.
export const PORT_NAME = "deep-review-offline-export-v1";
// Send one bounded chunk at a time, waiting for acknowledgement before the next.
export const CHUNK_SIZE = 256 * 1024;
// Limit JavaScript string length, which is not the same as its UTF-8 byte size.
export const MAX_PAYLOAD = 160 * 1024 * 1024;

/** Allow only supported HTTPS document routes, without URL credentials or custom ports. */
export function supportedUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      [
        "research.google",
        "www.research.google",
        "research.google.com",
        "www.research.google.com",
      ].includes(url.hostname) &&
      (/^\/deepreview\/documents\/[^/]+(?:\/reviews\/[^/]+)?\/?$/.test(
        url.pathname,
      ) ||
        (/^\/deepreview\/?$/.test(url.pathname) &&
          !!url.searchParams.get("paperId")))
    );
  } catch {
    return false;
  }
}

/** Hash the complete JSON to detect truncation or corruption during transfer. */
export async function digest(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Reject missing pages, duplicate IDs, broken links and invalid highlight geometry. */
export function validateSnapshot(s: Snapshot): void {
  if (
    s?.schemaVersion !== 1 ||
    !supportedUrl(s.metadata?.sourceUrl) ||
    !s.metadata.documentName ||
    !s.overallHtml
  ) {
    throw new Error(m("invalidSnapshot"));
  }
  if (!s.pages?.length || !s.comments?.length)
    throw new Error(m("emptySnapshot"));
  const ids = new Set(s.comments.map((c) => c.id));
  if (ids.size !== s.comments.length || ids.has(""))
    throw new Error(m("duplicateIds"));
  // Also verify the reverse link: every captured comment needs a page region.
  const linked = new Set<string>();
  s.pages.forEach((page, i) => {
    if (
      page.number !== i + 1 ||
      !page.src.startsWith("data:image/") ||
      !page.width ||
      !page.height
    ) {
      throw new Error(m("pageOrder"));
    }
    page.highlights.forEach((box) => {
      if (!ids.has(box.commentId)) throw new Error(m("brokenLink"));
      if (
        ![box.left, box.top, box.width, box.height].every(Number.isFinite) ||
        box.left < 0 ||
        box.top < 0 ||
        box.width <= 0 ||
        box.height <= 0 ||
        box.left + box.width > 100.1 ||
        box.top + box.height > 100.1
      ) {
        throw new Error(m("invalidCoordinates"));
      }
      linked.add(box.commentId);
    });
  });
  if ([...ids].some((id) => !linked.has(id)))
    throw new Error(m("unanchoredComment"));
  if (
    s.comments.some(
      (c) =>
        !c.title ||
        !c.bodyHtml ||
        !["critical", "major", "minor", "suggestion", "default"].includes(
          c.severity,
        ),
    )
  ) {
    throw new Error(m("invalidComment"));
  }
}

/** Keep HTTP(S) destinations without credentials, query parameters or fragments.
 * Query-based links may change; paths and visible content are not anonymized.
 */
export function cleanReferenceUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) return;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return;
  }
}

// Preserve rich text and the MathML/SVG text used by the formula renderer.
const BODY_TAGS = new Set(
  "a p div span h1 h2 h3 h4 h5 h6 ul ol li blockquote pre code strong b em i u s del ins sub sup br hr table thead tbody tfoot tr th td caption dl dt dd kbd samp small mark img math semantics mrow mi mo mn mtext annotation msub msup msubsup mfrac msqrt mroot munder mover munderover mtable mtr mtd mspace mfenced mpadded mstyle menclose svg g path text tspan line polyline polygon rect circle ellipse".split(
    " ",
  ),
);
// Remove these elements with their contents; unknown harmless wrappers are unwrapped.
const DROP_TAGS = new Set(
  "script style link meta base iframe object embed form input button select textarea foreignobject template noscript audio video source track canvas animate animatemotion animatetransform set".split(
    " ",
  ),
);
// Formula layout needs inline geometry, but no custom properties or resource loading.
const STYLE_PROPERTIES = new Set(
  "position direction display pointer-events height width min-width max-width left top right bottom inset opacity overflow overflow-x overflow-y user-select padding margin clip white-space border vertical-align font-family font-size font-style font-weight line-height color background-color text-align text-decoration letter-spacing".split(
    " ",
  ),
);
// Keep basic SVG geometry/text paint; references and animation are excluded.
const VECTOR_ATTRIBUTES = new Set(
  "width height viewbox fill stroke stroke-width stroke-linecap stroke-linejoin d transform x y x1 x2 y1 y2 cx cy r rx ry points dx dy text-anchor dominant-baseline".split(
    " ",
  ),
);

/** Parse declarations, then keep only formula/text CSS without resource syntax. */
function cleanStyle(raw: string): string {
  if (/[\\<>]|\/\*|url\s*\(|expression\s*\(|@import/i.test(raw)) return "";
  const style = document.createElement("span").style;
  style.cssText = raw;
  for (const name of [...style])
    if (!STYLE_PROPERTIES.has(name)) style.removeProperty(name);
  return style.cssText;
}

/** Inert template + explicit formatting allowlists; never copy arbitrary app data. */
export function cleanHtml(input: string): string {
  // Detached template contents stay inert while attributes and elements are filtered.
  const template = document.createElement("template");
  template.innerHTML = input;
  for (const el of [...template.content.querySelectorAll("*")]) {
    const tag = el.localName.toLowerCase();
    if (DROP_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    if (!BODY_TAGS.has(tag)) {
      el.replaceWith(...el.childNodes);
      continue;
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase(),
        value = attr.value;
      let keep = false;
      if (name === "class") {
        const classes = value
          .split(/\s+/)
          .filter((c) =>
            /^(?:xpm[\w-]*|xplatmath[\w-]*|katex[\w-]*|math[\w-]*|hljs[\w-]*|language-[\w-]+|md-[\w-]+|suggested-fix-inline)$/.test(
              c,
            ),
          );
        if (classes.length) {
          el.setAttribute("class", classes.join(" "));
          keep = true;
        }
      } else if (name === "style") {
        const css = cleanStyle(value);
        if (css) {
          el.setAttribute("style", css);
          keep = true;
        }
      } else if (name === "href" && tag === "a") {
        const href = cleanReferenceUrl(value);
        if (href) {
          el.setAttribute("href", href);
          keep = true;
        }
      } else if (name === "src" && tag === "img")
        keep = /^data:image\/(png|gif|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(
          value,
        );
      else if (name === "alt" && tag === "img") keep = true;
      else if (name === "aria-hidden") keep = /^(true|false)$/.test(value);
      else if (
        ["colspan", "rowspan"].includes(name) &&
        ["td", "th"].includes(tag)
      )
        keep = /^\d{1,3}$/.test(value);
      // These attributes explicitly support formula-to-plain-text report copying.
      else if (
        name === "data-latex" &&
        (el.classList.contains("xpm-math") ||
          el.classList.contains("xplatmath-inline"))
      )
        keep = true;
      else if (name === "data-xpm-copy-root") keep = true;
      else if (name === "encoding" && tag === "annotation")
        keep = value === "application/x-tex";
      else if (name === "xmlns" && ["math", "svg"].includes(tag))
        keep = [
          "http://www.w3.org/1998/Math/MathML",
          "http://www.w3.org/2000/svg",
        ].includes(value);
      else if (name === "direction") keep = /^(ltr|rtl)$/.test(value);
      else if (
        VECTOR_ATTRIBUTES.has(name) &&
        (el.namespaceURI === "http://www.w3.org/2000/svg" || tag === "img")
      )
        keep =
          /^[a-z0-9\s.,%#()+\-]*$/i.test(value) &&
          !/url|javascript|data:/i.test(value);
      if (!keep) el.removeAttribute(attr.name);
    }
    if (tag === "img" && !el.hasAttribute("src")) el.remove();
    if (tag === "a" && el.hasAttribute("href")) {
      el.setAttribute("rel", "noopener noreferrer");
      el.setAttribute("target", "_blank");
    }
  }
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_COMMENT,
  );
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((node) => node.parentNode?.removeChild(node));
  return template.innerHTML;
}
