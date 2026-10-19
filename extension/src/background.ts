/** Handle user actions and job messages; review bodies never pass through this worker. */
import { m } from "./i18n";
import { supportedUrl } from "./snapshot";

/** Show progress, success or failure on the source tab badge. */
async function badge(tabId: number, text: string, error = false) {
  await chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  await chrome.action
    .setBadgeBackgroundColor({ tabId, color: error ? "#b3261e" : "#1a73e8" })
    .catch(() => {});
}
/** Open an export task using the temporary activeTab grant from a user action. */
export async function exportCurrentTab(tab: chrome.tabs.Tab) {
  if (tab.id === undefined) return;
  const url = new URL(chrome.runtime.getURL("export.html"));
  if (supportedUrl(tab.url || ""))
    url.searchParams.set("sourceTabId", String(tab.id));
  else url.searchParams.set("error", m("startOnReview"));
  await badge(tab.id, "…");
  await chrome.tabs.create({
    url: url.href,
    active: !supportedUrl(tab.url || ""),
  });
}
chrome.action.onClicked.addListener((tab) => {
  void exportCurrentTab(tab).catch(() => {});
});

// Accept job-control messages only from this extension's own export page.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith(chrome.runtime.getURL("export.html"))
  )
    return;
  if (!["prepare", "badge", "show-error"].includes(message?.type)) return;
  void (async () => {
    const tabId = Number(message.sourceTabId);
    if (message.type === "show-error") {
      if (sender.tab?.id !== undefined)
        await chrome.tabs.update(sender.tab.id, { active: true });
      if (Number.isInteger(tabId)) await badge(tabId, "!", true);
      return { ok: true };
    }
    // Stop using the original grant if the source tab has navigated away.
    const source = await chrome.tabs.get(tabId);
    if (!supportedUrl(source.url || "")) throw new Error(m("sourceMoved"));
    if (message.type === "badge") {
      await badge(tabId, String(message.text || "").slice(0, 3));
      return { ok: true };
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["capture.js"],
    });
    return { ok: true };
  })().then(respond, (error) =>
    respond({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  return true;
});
