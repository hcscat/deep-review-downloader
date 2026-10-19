/** Receive a snapshot and own its local render, cancellation and download lifecycle. */
import { m } from "./i18n";
import { language } from "./i18n";
import {
  MAX_PAYLOAD,
  PORT_NAME,
  digest,
  validateSnapshot,
  type Snapshot,
} from "./snapshot";
import { downloadName, renderSnapshot } from "./render";

const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
// Static copy is translated before any asynchronous capture status is displayed.
document.documentElement.lang = language;
for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]"))
  el.textContent = m(el.dataset.i18n as Parameters<typeof m>[0]);
element("progress").setAttribute("aria-label", m("progressLabel"));
const heading = element("heading"),
  status = element("status");
const bar = element<HTMLProgressElement>("progress");
const cancel = element<HTMLButtonElement>("cancel"),
  close = element<HTMLButtonElement>("close"),
  show = element<HTMLButtonElement>("show-file");
// Pass only the tab ID in the URL; receive bodies directly over the capture port.
const sourceTabId = Number(
  new URL(location.href).searchParams.get("sourceTabId"),
);
// The job owns its capture port, output Blob and one Chrome download ID.
let port: chrome.runtime.Port | undefined,
  downloadId: number | undefined,
  blobUrl: string | undefined,
  // Once terminal, late callbacks must not revive progress or show success.
  finished = false,
  // After a complete transfer, closing the source port is expected, not an error.
  snapshotReceived = false,
  // A download ID can arrive after Cancel; keep that intent until it is handled.
  cancelRequested = false,
  downloadPending = false;
let inactivity: ReturnType<typeof setTimeout>;
const send = (type: string, extra: Record<string, unknown> = {}) =>
  chrome.runtime.sendMessage({ type, sourceTabId, ...extra });
/** Replace active progress/cancel controls with the finished task's Close action. */
function finishUi() {
  bar.hidden = true;
  cancel.hidden = true;
  close.hidden = false;
}
/** Disconnect once. Never send a cancel message through an already closed port. */
function stopPort() {
  const active = port;
  port = undefined;
  try {
    active?.disconnect();
  } catch {
    /* Already disconnected by the source. */
  }
}
/** The task owns this Blob; release it only after download creation has settled. */
function releaseBlob() {
  if (blobUrl && !downloadPending) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = undefined;
  }
}
/** Remove only this job's file if it completed before Chrome acknowledged Cancel. */
async function discardDownload(id: number) {
  try {
    await chrome.downloads.cancel(id).catch(() => {});
    const [item] = await chrome.downloads.search({ id });
    if (item?.state === "in_progress") throw new Error(m("cancelPending"));
    if (item?.state === "complete" && item.exists)
      await chrome.downloads.removeFile(id);
  } finally {
    releaseBlob();
  }
}
/** Tell the user when cancellation could not confirm removal of this job's file. */
function cancellationFailed(error: unknown) {
  status.textContent = m("cancelCleanupFailed", [
    error instanceof Error ? error.message : String(error),
  ]);
}
/** Enter failure once, disconnect capture and clean up this job's download resources. */
function fail(message: string) {
  if (finished) return;
  finished = true;
  clearTimeout(inactivity);
  stopPort();
  if (downloadId !== undefined)
    void discardDownload(downloadId).catch(() => {});
  else releaseBlob();
  document.body.classList.add("error");
  heading.textContent = m("failedHeading");
  status.textContent = message;
  finishUi();
  void send("show-error").catch(() => {});
}
/** Reset the inactivity deadline so a stalled job cannot wait indefinitely. */
function keepAlive() {
  clearTimeout(inactivity);
  inactivity = setTimeout(() => fail(m("jobTimeout")), 90000);
}
close.addEventListener("click", () => window.close());
cancel.addEventListener("click", () => {
  if (finished) return;
  cancelRequested = true;
  finished = true;
  stopPort();
  clearTimeout(inactivity);
  status.textContent = m("cancelStatus");
  heading.textContent = m("cancelHeading");
  finishUi();
  if (downloadId !== undefined)
    void discardDownload(downloadId).catch(cancellationFailed);
  else releaseBlob();
  void send("badge", { text: "" }).catch(() => {});
});
show.addEventListener("click", () => {
  if (downloadId !== undefined) chrome.downloads.show(downloadId);
});
window.addEventListener("pagehide", () => {
  stopPort();
  if (downloadId === undefined) releaseBlob();
});

/** Keep the output Blob in this task page so worker suspension does not lose it. */
async function save(snapshot: Snapshot) {
  validateSnapshot(snapshot);
  status.textContent = m("buildingViewer");
  const read = async (path: string) => {
    const response = await fetch(chrome.runtime.getURL(path));
    if (!response.ok) throw new Error(m("resourceFailed", [path]));
    return response.text();
  };
  const [css, runtime, fontNotices] = await Promise.all([
    read("viewer.css"),
    read("viewer-runtime.js"),
    read("THIRD_PARTY_NOTICES.txt"),
  ]);
  if (finished) return;
  const html = await renderSnapshot(snapshot, { css, runtime, fontNotices });
  if (finished) return;
  const details = element("details");
  details.hidden = false;
  for (const [label, value] of [
    [m("documentLabel"), snapshot.metadata.documentName],
    [
      m("capturedLabel"),
      m("capturedCounts", [
        snapshot.pages.length,
        snapshot.comments.length,
        snapshot.pages.reduce((n, p) => n + p.highlights.length, 0),
      ]),
    ],
  ]) {
    const dt = document.createElement("dt"),
      dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    details.append(dt, dd);
  }
  if (snapshot.diagnostics.length) {
    const list = element("diagnostics");
    list.hidden = false;
    snapshot.diagnostics.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      list.append(li);
    });
  }
  blobUrl = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
  // Confirm Chrome's terminal download state before displaying success.
  const completed = async (id: number) => {
    if (finished) return;
    const [item] = await chrome.downloads.search({ id });
    if (finished) return;
    if (!item || item.state === "in_progress") return;
    if (item.state === "interrupted") {
      fail(m("downloadInterrupted", [item.error || m("checkDownloads")]));
      releaseBlob();
      return;
    }
    finished = true;
    clearTimeout(inactivity);
    heading.textContent = m("savedHeading");
    status.textContent = m("savedStatus");
    finishUi();
    show.hidden = false;
    const where = element("location");
    where.textContent = item.filename;
    where.hidden = false;
    releaseBlob();
    await send("badge", { text: "✓" }).catch(() => {});
    document.documentElement.dataset.exportComplete = "true";
    document.documentElement.dataset.downloadId = String(id);
  };
  chrome.downloads.onChanged.addListener((delta) => {
    if (delta.id === downloadId && delta.state)
      void completed(delta.id).catch((e) => fail(String(e)));
  });
  downloadPending = true;
  try {
    downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename: downloadName(snapshot),
      conflictAction: "uniquify",
      saveAs: false,
    });
  } finally {
    downloadPending = false;
    if (finished && downloadId === undefined) releaseBlob();
  }
  // Cancel/timeout can win while the API promise is pending. Do not resurrect UI.
  if (finished) {
    try {
      await discardDownload(downloadId);
    } catch (error) {
      if (cancelRequested) cancellationFailed(error);
    }
    return;
  }
  status.textContent = m("downloading");
  bar.removeAttribute("value");
  await completed(downloadId);
}

/** Prepare capture, receive ordered chunks, verify integrity, then save the viewer. */
async function start() {
  const error = new URL(location.href).searchParams.get("error");
  if (error) throw new Error(error);
  if (!Number.isInteger(sourceTabId) || sourceTabId <= 0)
    throw new Error(m("startFromTab"));
  keepAlive();
  const prepared = await send("prepare");
  if (finished) return;
  if (!prepared?.ok) throw new Error(prepared?.error || m("permissionMissing"));
  port = chrome.tabs.connect(sourceTabId, { name: PORT_NAME });
  let manifest: { length: number; chunks: number; sha256: string } | undefined;
  // Validate chunk order, total length and checksum before accepting the snapshot.
  const chunks: string[] = [];
  port.onDisconnect.addListener(() => {
    port = undefined;
    if (!finished && !snapshotReceived) fail(m("sourceDisconnected"));
  });
  port.onMessage.addListener((message) => {
    if (finished) return;
    keepAlive();
    if (message.type === "progress") status.textContent = message.text;
    else if (message.type === "error") fail(message.message);
    else if (message.type === "manifest") {
      if (
        manifest ||
        !Number.isInteger(message.length) ||
        message.length <= 0 ||
        message.length > MAX_PAYLOAD ||
        !Number.isInteger(message.chunks) ||
        message.chunks <= 0 ||
        message.chunks > 1000 ||
        !/^[a-f0-9]{64}$/.test(message.sha256)
      ) {
        fail(m("invalidTransfer"));
        return;
      }
      manifest = message;
      bar.max = message.chunks;
      bar.value = 0;
    } else if (message.type === "chunk") {
      if (
        !manifest ||
        message.index !== chunks.length ||
        typeof message.data !== "string" ||
        chunks.length >= manifest.chunks
      ) {
        fail(m("chunkOrder"));
        return;
      }
      chunks.push(message.data);
      bar.value = chunks.length;
      status.textContent = m("transferring", [chunks.length, manifest.chunks]);
      port!.postMessage({ type: "ack", index: message.index });
    } else if (message.type === "complete") {
      snapshotReceived = true;
      void (async () => {
        if (!manifest || chunks.length !== manifest.chunks)
          throw new Error(m("missingChunks"));
        const raw = chunks.join("");
        chunks.length = 0;
        if (
          raw.length !== manifest.length ||
          (await digest(raw)) !== manifest.sha256
        )
          throw new Error(m("integrityFailed"));
        if (finished) return;
        stopPort();
        await save(JSON.parse(raw));
      })().catch((error) =>
        fail(error instanceof Error ? error.message : String(error)),
      );
    }
  });
  port.postMessage({ type: "start" });
}
void start().catch((error) =>
  fail(error instanceof Error ? error.message : String(error)),
);
