/** Exercise capture, source-state restoration and real downloads using fictional reviews. */
async function verifyExtension(page) {
  const context = page.context()
  const records = []
  const assert = (value, message) => {
    if (!value) throw new Error(message)
  }
  let [worker] = context.serviceWorkers()
  if (!worker) worker = await context.waitForEvent("serviceworker")
  const extensionId = new URL(worker.url()).hostname
  // Only generated fictional documents are used by the public test suite.
  const cases = ["demo-one", "demo-two"].map((name) => ({
    name,
    url: `https://research.google/deepreview/documents/demo-document-${name}`,
    path: `output/playwright/fixtures/${name}.html`,
    pages: 3,
    comments: 12,
    highlights: 12,
  }))
  await context.route("https://research.google/**", (route) =>
    route.fulfill({
      path:
        cases.find((c) => route.request().url() === c.url)?.path ||
        cases[0].path,
      contentType: "text/html; charset=utf-8",
    }),
  )
  // Wait for real image decoding so capture sees the same pixels as a loaded review.
  const openFixture = async (c) => {
    await page.goto(c.url)
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".annotated-pdf-page-img")].every(
        (i) => i.complete && i.naturalWidth,
      ),
    )
  }
  // Open the normal export task; the test-only host grant replaces a toolbar gesture.
  const launch = async () => {
    const tabId = await worker.evaluate(
      async (url) =>
        (await chrome.tabs.query({})).find((t) => t.url === url).id,
      page.url(),
    )
    const newPage = context.waitForEvent("page")
    await worker.evaluate(async (id) => {
      await chrome.tabs.create({
        url: chrome.runtime.getURL("export.html") + "?sourceTabId=" + id,
        active: false,
      })
    }, tabId)
    const exporter = await newPage
    await exporter.waitForURL(`chrome-extension://${extensionId}/export.html*`)
    return exporter
  }
  for (const c of cases) {
    await openFixture(c)
    if (c.name === "demo-two") {
      // Test restoration from a filtered Report view.
      await page.locator("#severity-filter").selectOption("minor")
      await page.locator(".view-mode-toggle-btn").click()
    }
    const before = await page.evaluate(() => ({
      pdf: document.querySelector(".pdf-manuscript-viewport").scrollTop,
      mode: document.querySelector(".view-mode-toggle-btn").textContent.trim(),
    }))
    const exporter = await launch()
    await exporter.waitForFunction(
      () =>
        document.documentElement.dataset.exportComplete === "true" ||
        document.body.classList.contains("error"),
      undefined,
      { timeout: 120000 },
    )
    const result = await exporter.evaluate(() => ({
      done: document.documentElement.dataset.exportComplete === "true",
      id: Number(document.documentElement.dataset.downloadId),
      message: document.getElementById("status").textContent,
    }))
    assert(result.done, `${c.name}: ${result.message}`)
    const item = await worker.evaluate(
      async (id) => (await chrome.downloads.search({ id }))[0],
      result.id,
    )
    assert(item.state === "complete", `${c.name}: download did not complete`)
    const after = await page.evaluate(() => ({
      pdf: document.querySelector(".pdf-manuscript-viewport").scrollTop,
      mode: document.querySelector(".view-mode-toggle-btn").textContent.trim(),
    }))
    assert(
      before.pdf === after.pdf && before.mode === after.mode,
      `${c.name}: original UI state not restored`,
    )
    if (c.name === "demo-two") {
      await page.locator(".view-mode-toggle-btn").click()
      assert(
        (await page.locator("#severity-filter").inputValue()) === "minor",
        "Original severity filter was not restored",
      )
    }
    await exporter.screenshot({
      path: `output/playwright/extension-${c.name}-complete.png`,
    })
    records.push({
      ...c,
      downloadId: result.id,
      filename: item.filename,
      bytes: item.fileSize,
      uiRestored: true,
    })
    await exporter.close()
  }
  await openFixture(cases[0])
  await page
    .locator("[data-margin-card-id]")
    .first()
    .evaluate((el) => el.remove())
  const incomplete = await launch()
  await incomplete.waitForSelector("body.error", { timeout: 60000 })
  const message = await incomplete.locator("#status").textContent()
  assert(
    /연결|link/i.test(message),
    `Incomplete snapshot did not produce a link error: ${message}`,
  )
  await incomplete.close()
  const unsupported = await context.newPage()
  await unsupported.goto("https://research.google/not-a-deepreview-document")
  const unsupportedTab = await worker.evaluate(
    async () =>
      (await chrome.tabs.query({})).find(
        (t) => t.url === "https://research.google/not-a-deepreview-document",
      ).id,
  )
  const errorPagePromise = context.waitForEvent("page")
  await worker.evaluate(async (id) => {
    await chrome.tabs.create({
      url: chrome.runtime.getURL("export.html") + "?sourceTabId=" + id,
      active: false,
    })
  }, unsupportedTab)
  const errorPage = await errorPagePromise
  await errorPage.waitForSelector("body.error")
  assert(
    (await errorPage.locator("#status").textContent()).includes("Deep Review"),
    "Unsupported-page error missing",
  )
  await errorPage.close()
  await unsupported.close()
  return {
    success: true,
    extensionId,
    scope:
      "Fictional generated fixtures in a separate Chromium profile; test copy has a fixture-origin host permission. Production uses activeTab only.",
    exports: records,
    negativeChecks: [
      "missing comment/highlight link rejected",
      "unsupported page rejected",
    ],
    productionToolbarClick:
      "export page launched through Chrome tabs API; physical toolbar click and real authenticated site require user smoke test",
  }
}
