/** Capture documentation images only from this project's fictional extension export. */
async function captureReadmeScreenshots(page) {
  const source = new URL(page.url())
  if (
    source.protocol !== "file:" ||
    !source.pathname.endsWith("/exported-demo-one.html")
  )
    throw new Error("Open the fictional extension export first.")
  await page.context().setOffline(true)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.reload()
  await page.waitForFunction(
    () => document.documentElement.dataset.viewerReady === "true",
  )
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.locator("#viewer-language").selectOption("en")
  await page.screenshot({ path: "docs/images/overview.png" })
  await page.locator("[data-comment-id]").first().click()
  await page.screenshot({ path: "docs/images/linked-feedback.png" })
  await page.locator(".view-mode-toggle-btn").click()
  await page.locator("#feedback-pane").evaluate((el) => {
    el.scrollTop = 0
  })
  await page.screenshot({ path: "docs/images/report.png" })
  await page.locator(".view-mode-toggle-btn").click()
  await page.reload()
  await page.waitForFunction(
    () => document.documentElement.dataset.viewerReady === "true",
  )
  await page.locator("#viewer-language").selectOption("ko")
  await page.screenshot({ path: "docs/images/overview-ko.png" })
  return {
    success: true,
    files: 4,
    size: [1440, 960],
    fictionalOnly: true,
    interfaceLanguages: ["en", "ko"],
  }
}
