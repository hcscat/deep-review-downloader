/** Capture the earlier store artwork using synthetic review content, never user documents. */
async function captureStoreScreenshots(page) {
  // Only a real extension export of the fictional fixture is photographed.
  const source = new URL(page.url())
  if (
    source.protocol !== "file:" ||
    !source.pathname.endsWith("/exported-demo-one.html")
  ) {
    throw new Error("Open the generated fictional extension export first.")
  }
  await page.context().setOffline(true)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.reload()
  await page.waitForFunction(
    () => document.documentElement.dataset.viewerReady === "true",
  )
  await page.evaluate(() => document.fonts.ready)
  // Preserve the actual UI, without compositing or hiding interface controls.
  await page.screenshot({ path: "store/assets/screenshot-01-overview.png" })
  await page.locator("[data-comment-id]").first().click()
  await page.screenshot({
    path: "store/assets/screenshot-02-linked-feedback.png",
  })
  await page.locator(".view-mode-toggle-btn").click()
  await page.locator("#feedback-pane").evaluate((el) => {
    el.scrollTop = 0
  })
  await page.screenshot({ path: "store/assets/screenshot-03-report.png" })
  await page.locator(".view-mode-toggle-btn").click()
  for (let index = 0; index < 5; index++)
    await page.getByRole("button", { name: "Zoom in PDF", exact: true }).click()
  // Present the natural left edge of the enlarged document in the store image.
  await page.locator("#pdf-pane").evaluate((el) => {
    el.scrollLeft = 0
  })
  await page.screenshot({ path: "store/assets/screenshot-04-zoom.png" })
  const root = new URL("../../", source)
  for (const [name, width, height] of [
    ["small", 440, 280],
    ["marquee", 1400, 560],
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto(new URL(`store/assets/promo-${name}.svg`, root).href)
    await page.screenshot({ path: `store/assets/promo-${name}.png` })
  }
  return {
    screenshots: 4,
    screenshotDimensions: [1280, 800],
    promoDimensions: [
      [440, 280],
      [1400, 560],
    ],
    fictionalContentOnly: true,
  }
}
