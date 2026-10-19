/** Collect one authorized review from the source DOM, then restore its UI state. */
import { m } from "./i18n";
import {
  CHUNK_SIZE,
  MAX_PAYLOAD,
  PORT_NAME,
  cleanHtml,
  digest,
  supportedUrl,
  validateSnapshot,
  type PageImage,
  type Snapshot,
} from "./snapshot";

// Register one port listener even if this tab receives repeated injections.
const marker = "__deepReviewOfflineCaptureV1";
const world = globalThis as typeof globalThis & { [marker]?: boolean };
if (!world[marker]) {
  world[marker] = true;
  // Allow one capture at a time so jobs cannot compete over source UI state.
  let busy = false;
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_NAME || port.sender?.id !== chrome.runtime.id)
      return;
    // Disconnecting the task aborts both page capture and chunk transfer.
    const abort = new AbortController();
    port.onDisconnect.addListener(() => abort.abort());
    // Track the acknowledgement for the single chunk currently in flight.
    let ack: { index: number; resolve: () => void } | undefined;
    port.onMessage.addListener((message) => {
      if (message.type === "cancel") abort.abort();
      if (message.type === "ack" && ack && ack.index === message.index) {
        ack.resolve();
        ack = undefined;
      }
      if (message.type !== "start") return;
      if (busy) {
        port.postMessage({
          type: "error",
          message: m("alreadyRunning"),
        });
        return;
      }
      busy = true;
      void (async () => {
        try {
          const snapshot = await capture(abort.signal, (text) =>
            port.postMessage({ type: "progress", text }),
          );
          // Restore the source UI before sending the completed snapshot.
          const payload = JSON.stringify(snapshot);
          if (payload.length > MAX_PAYLOAD) throw new Error(m("tooLarge"));
          const checksum = await digest(payload);
          const count = Math.ceil(payload.length / CHUNK_SIZE);
          port.postMessage({
            type: "manifest",
            length: payload.length,
            chunks: count,
            sha256: checksum,
          });
          for (let i = 0; i < count; i++) {
            abort.signal.throwIfAborted();
            await new Promise<void>((resolve, reject) => {
              const onAbort = () => {
                clearTimeout(timer);
                ack = undefined;
                reject(new Error(m("cancelled")));
              };
              const timer = setTimeout(() => {
                signalCleanup();
                ack = undefined;
                reject(new Error(m("transferTimeout")));
              }, 15000);
              const signalCleanup = () =>
                abort.signal.removeEventListener("abort", onAbort);
              abort.signal.addEventListener("abort", onAbort, { once: true });
              ack = {
                index: i,
                resolve: () => {
                  clearTimeout(timer);
                  signalCleanup();
                  resolve();
                },
              };
              port.postMessage({
                type: "chunk",
                index: i,
                data: payload.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
              });
            });
          }
          port.postMessage({ type: "complete" });
        } catch (error) {
          if (!abort.signal.aborted)
            port.postMessage({
              type: "error",
              message: error instanceof Error ? error.message : String(error),
            });
        } finally {
          busy = false;
        }
      })();
    });
  });
}

// Source labels drive the original app controls; exported UI translations are separate.
const text = (node: Element | null) => node?.textContent?.trim() || "";
const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
/** Wait for source elements or images, with a deadline and cancellation checks. */
async function until(
  test: () => boolean,
  signal: AbortSignal,
  timeout = 20000,
) {
  const deadline = Date.now() + timeout;
  while (!test()) {
    signal.throwIfAborted();
    if (Date.now() > deadline) throw new Error(m("loadingTimeout"));
    await pause(60);
  }
}
/** Wait briefly for Angular rendering to settle, with a hard time limit. */
async function quiet(root: Element, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timer);
      clearTimeout(limit);
      observer.disconnect();
      signal.removeEventListener("abort", cancel);
      resolve();
    };
    const cancel = () => {
      clearTimeout(timer);
      clearTimeout(limit);
      observer.disconnect();
      reject(new Error(m("cancelled")));
    };
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(finish, 180);
    });
    const limit = setTimeout(finish, 2500);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    signal.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(finish, 180);
  });
}
/** Locate the source button without keeping a reference across view changes. */
function modeToggle() {
  return document.querySelector<HTMLElement>(".view-mode-toggle-btn");
}
/** In Report mode, the button offers the opposite action: View as Comments. */
function isReport() {
  return /view as comments?/i.test(text(modeToggle()));
}
/** Find either the source Angular filter or the offline viewer's native select. */
function filterControl() {
  return (
    document.querySelector<HTMLElement>(
      "#severity-filter, #category-filter-picker, mat-select.category-filter-select",
    ) ||
    [...document.querySelectorAll<HTMLElement>("mat-select")].find((el) =>
      /^(all types|critical|major|minor|suggestion)/i.test(text(el)),
    )
  );
}
/** Use normal change/click events so the source app updates its displayed comments. */
async function chooseFilter(label: string, signal: AbortSignal) {
  const control = filterControl();
  if (!control) return;
  if (control instanceof HTMLSelectElement) {
    const option = [...control.options].find(
      (o) => text(o).toLowerCase() === label.toLowerCase(),
    );
    if (!option) throw new Error(m("filterMissing"));
    control.value = option.value;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    (
      control.querySelector<HTMLElement>(".mat-mdc-select-trigger") || control
    ).click();
    const options = () => [
      ...document.querySelectorAll<HTMLElement>('mat-option,[role="option"]'),
    ];
    await until(
      () =>
        options().some((o) => text(o).toLowerCase() === label.toLowerCase()),
      signal,
      4000,
    );
    options()
      .find((o) => text(o).toLowerCase() === label.toLowerCase())!
      .click();
  }
}
/** Keep the source document address and its required ID, without unrelated queries. */
function sourceUrl() {
  const url = new URL(location.href);
  const paperId = url.searchParams.get("paperId");
  url.search = "";
  url.hash = "";
  if (paperId && /^\/deepreview\/?$/.test(url.pathname))
    url.searchParams.set("paperId", paperId);
  return url.href;
}
/** Identify the source document and review version to detect changes during capture. */
function identity() {
  let review = "";
  try {
    const value =
      new URL(
        document.querySelector(".review-feedback-btn")?.getAttribute("href") ||
          "",
      ).searchParams.get("entry.98741210") || "";
    if (/^documents\/[^/]+\/reviews\/[^/]+$/.test(value)) review = value;
  } catch {}
  return [
    sourceUrl(),
    text(document.querySelector(".review-version-switcher")),
    review,
  ].join("|");
}
/** Read embedded data or loaded pixels; do not issue authenticated image requests. */
async function imageData(img: HTMLImageElement): Promise<string> {
  if (/^data:image\/(png|jpeg|webp);base64,/i.test(img.src)) return img.src;
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(m("canvasFailed"));
  try {
    context.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    throw new Error(m("imageRestricted"));
  }
}

/** Capture the visible DOM and restore temporary mode, filter, focus and scroll changes. */
async function capture(
  signal: AbortSignal,
  progress: (text: string) => void,
): Promise<Snapshot> {
  if (!supportedUrl(location.href)) throw new Error(m("reviewOnly"));
  const root = document.querySelector("deepreview-review-viewer");
  const pdf = document.querySelector<HTMLElement>(".pdf-manuscript-viewport");
  const feedback = document.querySelector<HTMLElement>(".feedback-stream-pane");
  if (!root || !pdf || !feedback) throw new Error(m("reviewMissing"));
  const routeId =
    location.pathname.match(/\/documents\/([^/]+)/)?.[1] ||
    new URL(location.href).searchParams.get("paperId");
  const displayedId = text(root.querySelector(".doc-id-pill code"));
  if (routeId && displayedId && routeId !== displayedId)
    throw new Error(m("documentLoading"));
  // Remember the source UI state before making any temporary changes.
  const startIdentity = identity();
  const wasReport = isReport();
  const filter = filterControl();
  let oldFilter =
    filter instanceof HTMLSelectElement
      ? text(filter.selectedOptions[0])
      : text(filter || null);
  // Each pane scrolls independently, so save both axes for both panes.
  const scroll = {
    pdfTop: pdf.scrollTop,
    pdfLeft: pdf.scrollLeft,
    feedbackTop: feedback.scrollTop,
    feedbackLeft: feedback.scrollLeft,
  };
  const focused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  let modeChanged = false,
    filterChanged = false;
  try {
    if (wasReport) {
      progress(m("checkingComments"));
      modeToggle()?.click();
      modeChanged = true;
      await until(() => !!root.querySelector("[data-margin-card-id]"), signal);
      const revealedFilter = filterControl();
      if (!oldFilter)
        oldFilter =
          revealedFilter instanceof HTMLSelectElement
            ? text(revealedFilter.selectedOptions[0])
            : text(revealedFilter || null);
    }
    if (oldFilter && !/^all types$/i.test(oldFilter)) {
      await chooseFilter("All Types", signal);
      filterChanged = true;
    }
    await quiet(root, signal);
    // Cache each page so virtualized pages remain available after leaving the DOM.
    const pages = new Map<number, PageImage>();
    // A second pass at the bottom gives delayed page rendering time to finish.
    let bottomPasses = 0;
    pdf.scrollTop = 0;
    for (let step = 0; step < 180; step++) {
      signal.throwIfAborted();
      await quiet(root, signal);
      const wrappers = [
        ...root.querySelectorAll<HTMLElement>("[data-pdf-page-wrapper]"),
      ];
      await until(
        () =>
          wrappers.every((w) => {
            const img = w.querySelector("img.annotated-pdf-page-img");
            return (
              img instanceof HTMLImageElement &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        signal,
      );
      for (const wrapper of wrappers) {
        const number = Number(
          wrapper.dataset.pageNumber || wrapper.dataset.pdfPageWrapper,
        );
        const img = wrapper.querySelector<HTMLImageElement>(
          "img.annotated-pdf-page-img",
        )!;
        if (pages.has(number)) continue;
        const highlights = [
          ...wrapper.querySelectorAll<HTMLElement>(".pdf-bbox-highlight"),
        ].map((box) => {
          const rect = box.getBoundingClientRect(),
            image = img.getBoundingClientRect();
          // Prefer source percentages; otherwise convert geometry relative to the page image.
          const coordinate = (key: "left" | "top" | "width" | "height") => {
            const value = box.style[key];
            if (value.endsWith("%")) return parseFloat(value);
            return key === "left"
              ? ((rect.left - image.left) / image.width) * 100
              : key === "top"
                ? ((rect.top - image.top) / image.height) * 100
                : key === "width"
                  ? (rect.width / image.width) * 100
                  : (rect.height / image.height) * 100;
          };
          return {
            commentId: box.dataset.commentId || "",
            left: coordinate("left"),
            top: coordinate("top"),
            width: coordinate("width"),
            height: coordinate("height"),
          };
        });
        pages.set(number, {
          number,
          src: await imageData(img),
          width: img.naturalWidth,
          height: img.naturalHeight,
          highlights,
        });
      }
      progress(m("capturingPages", [pages.size]));
      const bottom = pdf.scrollHeight - pdf.clientHeight;
      if (pdf.scrollTop >= bottom - 2) {
        if (++bottomPasses >= 2) break;
      } else bottomPasses = 0;
      pdf.scrollTop = Math.min(
        bottom,
        pdf.scrollTop + Math.max(250, pdf.clientHeight * 0.85),
      );
      if (step === 179) throw new Error(m("incompleteDocument"));
    }
    const summary = root.querySelector<HTMLElement>(".overall-summary-body");
    const comments = [
      ...root.querySelectorAll<HTMLElement>("[data-margin-card-id]"),
    ].map((card) => ({
      id: card.dataset.marginCardId || "",
      severity: text(card.querySelector(".severity-badge")).toLowerCase(),
      title: text(card.querySelector(".comment-summary")),
      bodyHtml: cleanHtml(card.querySelector(".comment-body")?.innerHTML || ""),
      location: text(card.querySelector(".comment-location-footer")),
    }));
    if (identity() !== startIdentity) throw new Error(m("identityChanged"));
    const pathId = location.pathname.match(/\/documents\/([^/]+)/)?.[1];
    // Report source-count limits and do not claim to recover previously dismissed comments.
    const diagnostics = [m("captureDiagnostic")];
    const expected = Number(
      root.querySelector("[data-page-count]")?.getAttribute("data-page-count"),
    );
    if (expected && expected !== pages.size)
      throw new Error(m("missingPages", [expected, pages.size]));
    const snapshot: Snapshot = {
      schemaVersion: 1,
      metadata: {
        documentId:
          pathId || new URL(location.href).searchParams.get("paperId") || "",
        documentName: text(root.querySelector(".review-viewer-header-title")),
        versionLabel: text(root.querySelector(".review-version-switcher")),
        sourceUrl: sourceUrl(),
        capturedAt: new Date().toISOString(),
        reviewIdentity: startIdentity,
      },
      overallHtml: cleanHtml(summary?.innerHTML || ""),
      summaryExpanded: !summary?.classList.contains("collapsed"),
      pages: [...pages.values()].sort((a, b) => a.number - b.number),
      comments,
      diagnostics,
    };
    validateSnapshot(snapshot);
    return snapshot;
  } finally {
    if (identity() === startIdentity) {
      // Restore even after cancellation; use a separate, short-lived restore signal.
      try {
        if (filterChanged && oldFilter)
          await chooseFilter(oldFilter, new AbortController().signal);
        if (modeChanged && !isReport()) modeToggle()?.click();
        await quiet(root, new AbortController().signal);
        pdf.scrollTo({
          top: scroll.pdfTop,
          left: scroll.pdfLeft,
          behavior: "instant",
        });
        feedback.scrollTo({
          top: scroll.feedbackTop,
          left: scroll.feedbackLeft,
          behavior: "instant",
        });
        if (focused?.isConnected) focused.focus({ preventScroll: true });
      } catch {
        /* A navigated/closed source tab cannot be restored. */
      }
    }
  }
}
