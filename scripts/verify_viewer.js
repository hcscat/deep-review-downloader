/** Verify offline resources and interactive controls without changing the OS clipboard. */
async function verifyViewer(page) {
  const results = []
  const errors = []
  const requests = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url())
  })
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  const record = (name, details) =>
    results.push({ name, passed: true, ...details })
  await page.context().setOffline(true)
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.reload()
  await page.waitForFunction(
    () => document.documentElement.dataset.viewerReady === "true",
  )
  // Use English for stable existing selectors, then verify Korean separately.
  await page.locator("#viewer-language").selectOption("en")
  // A fixture may have no formula. Explicitly load the embedded math font so
  // validation checks its availability rather than whether this text used it.
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('16px "Google Sans"', "Review"),
      document.fonts.load('16px "STIXTwoMath-Regular"', "αβ∑"),
    ])
    await document.fonts.ready
  })
  if (
    (await page.locator(".read-more-btn").getAttribute("aria-expanded")) ===
    "false"
  )
    await page.locator(".read-more-btn").click()
  const initial = await page.evaluate(() => {
    const manifest = JSON.parse(
      document.getElementById("snapshot-manifest").textContent,
    )
    return {
      manifest,
      pages: [...document.querySelectorAll(".annotated-pdf-page-img")].map(
        (i) => ({ complete: i.complete, width: i.naturalWidth }),
      ),
      fonts: ["Google Sans", "STIXTwoMath-Regular"].map((f) =>
        document.fonts.check(`16px "${f}"`),
      ),
      summaryHeight: document.getElementById("overall-summary-body")
        .clientHeight,
    }
  })
  assert(
    initial.manifest.pageCount === initial.pages.length &&
      initial.manifest.commentCount ===
        (await page.locator("[data-margin-card-id]").count()) &&
      initial.manifest.highlightCount ===
        (await page.locator(".pdf-bbox-highlight").count()),
    "Snapshot counts differ",
  )
  assert(
    initial.pages.every((i) => i.complete && i.width > 0),
    "Page image failed to load offline",
  )
  assert(initial.fonts.every(Boolean), "Embedded fonts failed to load")
  record("Offline file, page images, and embedded fonts", {
    pages: initial.manifest.pageCount,
    comments: initial.manifest.commentCount,
    highlights: initial.manifest.highlightCount,
  })
  await page.screenshot({ path: "output/playwright/comments-expanded.png" })

  const more = page.locator(".read-more-btn")
  await more.click()
  assert(
    (await more.getAttribute("aria-expanded")) === "false",
    "Read less did not collapse",
  )
  assert(
    (await page
      .locator("#overall-summary-body")
      .evaluate((el) => el.clientHeight)) <= 150,
    "Collapsed summary is not clipped",
  )
  assert(
    await page.evaluate(
      () =>
        document.querySelector(".overall-summary-card").getBoundingClientRect()
          .top >=
        document.getElementById("feedback-pane").getBoundingClientRect().top,
    ),
    "Collapsing left the summary outside the viewport",
  )
  await page.screenshot({ path: "output/playwright/comments-collapsed.png" })
  await more.click()
  assert(
    (await more.getAttribute("aria-expanded")) === "true",
    "Read more did not expand",
  )
  assert(
    (await page
      .locator("#overall-summary-body")
      .evaluate((el) => el.clientHeight)) === initial.summaryHeight,
    "Summary content was lost",
  )
  record("Read more and Read less")

  const toggle = page.locator(".view-mode-toggle-btn")
  await page.locator("#feedback-pane").evaluate((el) => {
    el.scrollTop = 600
  })
  await toggle.click()
  assert(await page.locator("#report-view").isVisible(), "Report did not open")
  assert(await page.locator("#comments-view").isHidden(), "Comments not hidden")
  assert(
    (await page.locator("[data-report-comment-id]").count()) ===
      initial.manifest.commentCount,
    "Report lost comments",
  )
  await page.locator("#feedback-pane").evaluate((el) => {
    el.scrollTop = 500
  })
  await toggle.click()
  assert(
    (await page.locator("#feedback-pane").evaluate((el) => el.scrollTop)) ===
      600,
    "Comments scroll position not restored",
  )
  await toggle.click()
  assert(
    (await page.locator("#feedback-pane").evaluate((el) => el.scrollTop)) ===
      500,
    "Report scroll position not restored",
  )
  await page.locator("#feedback-pane").evaluate((el) => {
    el.scrollTop = 0
  })
  await page.screenshot({ path: "output/playwright/report.png" })
  await toggle.click()
  record("Report/Comments switch and independent scroll positions")

  const ids = initial.manifest.commentIds
  for (const id of ids) {
    // Real pointer clicks exercise the card event delegation and left-pane movement.
    await page.locator(`[data-margin-card-id="${id}"] .comment-summary`).click()
    const check = await page.evaluate((id) => {
      const card = document.querySelector(`[data-margin-card-id="${id}"]`)
      const box = document.querySelector(`[data-comment-id="${id}"]`)
      const pane = document.getElementById("pdf-pane").getBoundingClientRect()
      const rect = box.getBoundingClientRect()
      return {
        selected: card.classList.contains("selected"),
        boxSelected: box.classList.contains("selected"),
        inside: rect.top >= pane.top - 1 && rect.top < pane.bottom,
        page: box.closest("[data-page-number]").dataset.pageNumber,
      }
    }, id)
    assert(
      check.selected && check.boxSelected && check.inside,
      `Comment navigation failed: ${id} ${JSON.stringify(check)}`,
    )
  }
  record("All comment cards -> PDF: real pointer clicks", {
    count: ids.length,
  })

  const boxCount = await page.locator(".pdf-bbox-highlight").count()
  for (let i = 0; i < boxCount; i++) {
    // Exhaustive handler coverage includes overlapping rectangles that cannot all
    // receive the same physical pointer position. Real pointer checks follow below.
    await page.locator(".pdf-bbox-highlight").nth(i).dispatchEvent("click")
    const check = await page.evaluate((i) => {
      const box = document.querySelectorAll(".pdf-bbox-highlight")[i]
      const id = box.dataset.commentId
      const card = document.querySelector(`[data-margin-card-id="${id}"]`)
      const pane = document
        .getElementById("feedback-pane")
        .getBoundingClientRect()
      const rect = card.getBoundingClientRect()
      return {
        focused: document.activeElement === card,
        selected: card.classList.contains("selected"),
        visible:
          !card.hidden && rect.top >= pane.top - 1 && rect.top < pane.bottom,
        commentsMode: !document.getElementById("comments-view").hidden,
      }
    }, i)
    assert(
      check.focused && check.selected && check.visible && check.commentsMode,
      `Highlight navigation failed: ${i} ${JSON.stringify(check)}`,
    )
  }
  record("All PDF rectangles -> matching comment, focus and pane scroll", {
    count: boxCount,
    input: "DOM click events",
  })

  const firstBox = page.locator(".pdf-bbox-highlight").first()
  const firstBoxId = await firstBox.getAttribute("data-comment-id")
  await firstBox.scrollIntoViewIfNeeded()
  await firstBox.click()
  assert(
    (await page
      .locator(`[data-margin-card-id="${firstBoxId}"]`)
      .getAttribute("aria-current")) === "true",
    "Pointer highlight navigation failed",
  )
  const lastBox = page.locator(".pdf-bbox-highlight").last()
  await lastBox.focus()
  await lastBox.press("Enter")
  assert(
    (await page
      .locator(
        `[data-margin-card-id="${await lastBox.getAttribute("data-comment-id")}"]`,
      )
      .getAttribute("aria-current")) === "true",
    "Keyboard highlight navigation failed",
  )
  await page.locator(`[data-margin-card-id="${firstBoxId}"]`).focus()
  await page.locator(`[data-margin-card-id="${firstBoxId}"]`).press("Space")
  assert(
    (await firstBox.getAttribute("aria-pressed")) === "true",
    "Keyboard comment navigation failed",
  )
  record("Pointer highlight and keyboard navigation")

  const minorCount = await page
    .locator('[data-margin-card-id][data-severity="minor"]')
    .count()
  const nonMinorId = await page
    .locator('[data-margin-card-id]:not([data-severity="minor"])')
    .first()
    .getAttribute("data-margin-card-id")
  await page.locator("#severity-filter").selectOption("minor")
  assert(
    (await page.locator("[data-margin-card-id]:visible").count()) ===
      minorCount,
    "Severity filter count incorrect",
  )
  await page
    .locator(`[data-margin-card-id="${nonMinorId}"]`)
    .dispatchEvent("click")
  assert(
    (await page.locator("#severity-filter").inputValue()) === "ALL",
    "Selected target was not revealed",
  )
  const firstCard = page.locator(`[data-margin-card-id="${ids[0]}"]`)
  await firstCard.locator(".figma-dismiss-btn").click()
  assert(await firstCard.isHidden(), "Dismiss failed")
  await page.locator("#restore-dismissed").click()
  assert(await firstCard.isVisible(), "Restore failed")
  record("Filter, reveal selected target, Dismiss and Restore")

  await toggle.click()
  await firstBox.scrollIntoViewIfNeeded()
  await firstBox.click()
  assert(
    await page.locator("#comments-view").isVisible(),
    "Highlight did not return from Report to Comments",
  )
  record("Report -> highlight -> matching Comments card")

  const alignment = async () =>
    page.evaluate(() => {
      const box = document.querySelector(".pdf-bbox-highlight")
      const page = box.closest("[data-page-number]")
      const r = box.getBoundingClientRect(),
        p = page.getBoundingClientRect()
      // Percentages refer to the image inside the original 1px page border.
      const image = page.querySelector("img").getBoundingClientRect()
      return {
        pageWidth: p.width,
        left: (100 * (r.left - image.left)) / image.width,
        top: (100 * (r.top - image.top)) / image.height,
        width: (100 * r.width) / image.width,
        expectedLeft: parseFloat(box.style.left),
        expectedTop: parseFloat(box.style.top),
        expectedWidth: parseFloat(box.style.width),
      }
    })
  const zooms = []
  const out = page.getByRole("button", { name: "Zoom out PDF", exact: true })
  const plus = page.getByRole("button", { name: "Zoom in PDF", exact: true })
  const reset = page.locator(".zoom-reset-btn")
  for (let i = 0; i < 5; i++) await out.click()
  assert(await out.isDisabled(), "Minimum zoom bound failed")
  zooms.push({ zoom: 50, ...(await alignment()) })
  await reset.click()
  zooms.push({ zoom: 100, ...(await alignment()) })
  for (let i = 0; i < 10; i++) await plus.click()
  zooms.push({ zoom: 200, ...(await alignment()) })
  await firstCard.locator(".comment-summary").click()
  await page.screenshot({ path: "output/playwright/zoom-200.png" })
  for (let i = 0; i < 30; i++) await plus.click()
  assert(await plus.isDisabled(), "Maximum zoom bound failed")
  zooms.push({ zoom: 500, ...(await alignment()) })
  for (const zoom of zooms) {
    assert(
      Math.abs(zoom.pageWidth - (640 * zoom.zoom) / 100) < 1,
      `PDF width wrong at ${zoom.zoom}%`,
    )
    assert(
      Math.abs(zoom.left - zoom.expectedLeft) < 0.05 &&
        Math.abs(zoom.top - zoom.expectedTop) < 0.05 &&
        Math.abs(zoom.width - zoom.expectedWidth) < 0.05,
      `Highlight shifted at ${zoom.zoom}%`,
    )
  }
  await reset.click()
  record("Zoom limits, reset and highlight alignment", {
    values: zooms.map((z) => z.zoom),
  })

  // Stub the isolated test page's clipboard, so verification does not overwrite
  // the user's OS clipboard. Check the actual Copy Report button's payload.
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__testCopiedText = text
        },
      },
    })
  })
  await page.locator("#severity-filter").selectOption("critical")
  await page.locator(".copy-report-btn").click()
  const copied = await page.evaluate(() => window.__testCopiedText)
  const titles = await page
    .locator("[data-margin-card-id] .comment-summary")
    .allTextContents()
  assert(
    copied.length > 1000 &&
      titles.every((title) =>
        copied.replace(/\s+/g, " ").includes(title.replace(/\s+/g, " ")),
      ),
    "Copy Report omitted filtered comments",
  )
  record("Copy Report payload with active filter", {
    characters: copied.length,
    clipboard: "stubbed, OS clipboard unchanged",
  })
  await page.locator("#severity-filter").selectOption("ALL")

  await page.setViewportSize({ width: 1920, height: 1080 })
  const desktop = await page.evaluate(() => ({
    bodyOverflow: document.documentElement.scrollWidth > innerWidth,
    pdfWidth: document.getElementById("pdf-pane").clientWidth,
    feedbackWidth: document.getElementById("feedback-pane").clientWidth,
  }))
  assert(
    !desktop.bodyOverflow &&
      desktop.pdfWidth > 300 &&
      desktop.feedbackWidth > 300,
    "Desktop layout clipped",
  )
  await page.setViewportSize({ width: 640, height: 900 })
  const compact = await page.evaluate(() => ({
    bodyOverflow: document.documentElement.scrollWidth > innerWidth,
    pdfWidth: document.getElementById("pdf-pane").clientWidth,
    feedbackWidth: document.getElementById("feedback-pane").clientWidth,
  }))
  assert(
    !compact.bodyOverflow &&
      compact.pdfWidth > 150 &&
      compact.feedbackWidth > 150,
    "Compact layout clipped",
  )
  record("Desktop and compact viewport layout", { desktop, compact })

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.locator("#pdf-pane").evaluate((el) => {
    el.scrollTop = 0
    el.scrollLeft = 0
  })
  await page.locator("#feedback-pane").evaluate((el) => {
    el.scrollTop = 0
  })
  assert(
    requests.length === 0,
    `Unexpected network requests: ${requests.join(", ")}`,
  )
  assert(errors.length === 0, `Browser errors: ${errors.join("; ")}`)
  record("No HTTP(S) requests or browser errors", {
    requests: requests.length,
    errors: errors.length,
  })
  const bodyBefore = await page
    .locator("[data-margin-card-id] .comment-body")
    .allTextContents()
  await page.locator("#viewer-language").selectOption("ko")
  assert(
    (await page.locator(".severity-badge").allTextContents()).every(
      (t) => t.trim().length > 0,
    ),
    "Translated severity badge is empty",
  )
  assert(
    await page
      .locator(".view-mode-toggle-btn")
      .textContent()
      .then((t) => t.includes("보고서")),
    "Korean viewer controls missing",
  )
  await page.locator(".view-mode-toggle-btn").click()
  assert(
    await page
      .locator(".view-mode-toggle-btn")
      .textContent()
      .then((t) => t.includes("코멘트")),
    "Korean mode switch missing",
  )
  await page.locator(".view-mode-toggle-btn").click()
  assert(
    JSON.stringify(bodyBefore) ===
      JSON.stringify(
        await page
          .locator("[data-margin-card-id] .comment-body")
          .allTextContents(),
      ),
    "Language switch rewrote review content",
  )
  await page.locator("#viewer-language").selectOption("en")
  assert(
    (await page.locator(".severity-badge").allTextContents()).every(
      (t) => t.trim().length > 0,
    ),
    "English severity badge is empty",
  )
  record("English/Korean interface switch preserves review content", {
    languages: ["en", "ko"],
  })
  return {
    success: true,
    url: page.url(),
    offlineFromNavigation: true,
    checks: results,
  }
}
