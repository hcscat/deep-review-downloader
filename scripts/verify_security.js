/** Check sanitization and pause real download operations at cancellation race boundaries. */
async function verifySecurity(page) {
  const context = page.context()
  const [worker] = context.serviceWorkers()
  const extensionId = new URL(worker.url()).hostname
  const records = []
  const assert = (ok, message) => {
    if (!ok) throw new Error(message)
  }
  await context.route("https://research.google/**", (route) =>
    route.fulfill({
      path: "output/playwright/fixtures/demo-one.html",
      contentType: "text/html; charset=utf-8",
    }),
  )
  // The probe exposes sanitizer helpers only in the isolated test extension.
  const probe = await context.newPage()
  await probe.goto(`chrome-extension://${extensionId}/export.html?error=audit`)
  await probe.waitForSelector("body.error")
  await probe.addScriptTag({
    url: `chrome-extension://${extensionId}/security-probe.js`,
  })
  const cleaned = await probe.evaluate(() => {
    const api = globalThis.__reviewAudit
    const reference = new URL(
      "https://reference.invalid/paper?token=example#fragment",
    )
    reference.username = "sample"
    reference.password = "example"
    const credentialSource = new URL(
      "https://research.google/deepreview/documents/demo",
    )
    credentialSource.username = "sample"
    credentialSource.password = "example"
    const source =
      '<p class="md-paragraph" data-private-note="example">Body <a href="https://reference.invalid/paper?token=example#fragment" ping="https://reference.invalid/ping" data-private-note="example">reference</a></p><script>throw 1</script><iframe src="https://reference.invalid/frame"></iframe><img src="https://reference.invalid/image"><span class="xplatmath-inline" data-latex="x^2" style="position:relative;display:inline-block"><span data-xpm-copy-root=""><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><msup><mi>x</mi><mn>2</mn></msup><annotation encoding="application/x-tex">x^2</annotation></semantics></math><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10"><text style="font-size:12px" fill="currentColor" transform="translate(0 1)">x</text><animate attributeName="href" values="javascript:alert(1)"></animate></svg></span></span><span style="background-image:u\\72l(https://reference.invalid/image)">Escaped CSS</span>'
    const html = api.cleanHtml(
      source.replace(
        "https://reference.invalid/paper?token=example#fragment",
        reference.href,
      ),
    )
    const template = document.createElement("template")
    template.innerHTML = html
    const a = template.content.querySelector("a")
    return {
      href: a.getAttribute("href"),
      attributes: [...a.attributes].map((a) => a.name).sort(),
      hidden: !!template.content.querySelector(
        "[data-private-note],[ping],[onload],script,iframe,animate,img",
      ),
      math: !!template.content.querySelector("math msup mi"),
      svg: !!template.content.querySelector("svg text"),
      latex: template.content
        .querySelector("[data-latex]")
        .getAttribute("data-latex"),
      mathStyle: template.content
        .querySelector(".xplatmath-inline")
        .getAttribute("style"),
      idempotent: api.cleanHtml(html) === html,
      unsafeSchemes: [
        "javascript:alert(1)",
        "data:text/html,test",
        "file:///example",
        "mailto:sample",
      ].every((u) => api.cleanReferenceUrl(u) === undefined),
      rejectedSource:
        !api.supportedUrl(credentialSource.href) &&
        !api.supportedUrl(
          "https://research.google:8443/deepreview/documents/demo",
        ),
    }
  })
  assert(
    cleaned.href === "https://reference.invalid/paper" && !cleaned.hidden,
    "Sensitive attributes or URL data survived",
  )
  assert(
    JSON.stringify(cleaned.attributes) ===
      JSON.stringify(["href", "rel", "target"]),
    "Unexpected anchor attributes",
  )
  assert(
    cleaned.math &&
      cleaned.svg &&
      cleaned.latex === "x^2" &&
      cleaned.mathStyle.includes("relative"),
    "Formula markup was damaged",
  )
  assert(
    cleaned.idempotent && cleaned.unsafeSchemes && cleaned.rejectedSource,
    "Sanitizer invariants failed",
  )
  records.push({
    name: "HTML/URL allowlist and formula preservation",
    passed: true,
  })
  const localized = await probe.evaluate(() => ({
    language: document.documentElement.lang,
    title: document.title,
    close: document.getElementById("close").textContent,
    uiLanguage: chrome.i18n.getUILanguage(),
    defaultLocale: chrome.runtime.getManifest().default_locale,
  }))
  assert(localized.defaultLocale === "en", "Missing English fallback")
  assert(
    localized.close ===
      (localized.language === "ko" ? "이 탭 닫기" : "Close this tab"),
    "Extension localization missing",
  )
  records.push({
    name: "Native extension localization",
    passed: true,
    ...localized,
  })
  await probe.close()

  // Pause at the exact asynchronous boundaries from the original cancellation bug.
  await context.addInitScript(() => {
    if (location.protocol !== "chrome-extension:") return
    const mode = new URL(location.href).searchParams.get("auditMode")
    if (!mode) return
    const api = (globalThis.audit = {
      mode,
      downloadCalls: 0,
      cancelIds: [],
      removeIds: [],
    })
    // Hold one API boundary until the test clicks Cancel, then let it finish normally.
    const gate = () =>
      new Promise((resolve) => {
        api.release = resolve
        api.waiting = true
      })
    const read = globalThis.fetch.bind(globalThis)
    globalThis.fetch = async (...args) => {
      if (mode === "resources" && String(args[0]).endsWith("/viewer.css"))
        await gate()
      return read(...args)
    }
    const download = chrome.downloads.download.bind(chrome.downloads)
    const cancel = chrome.downloads.cancel.bind(chrome.downloads)
    const remove = chrome.downloads.removeFile.bind(chrome.downloads)
    chrome.downloads.cancel = async (id) => {
      api.cancelIds.push(id)
      return cancel(id)
    }
    chrome.downloads.removeFile = async (id) => {
      api.removeIds.push(id)
      if (mode === "cleanup-error") throw new Error("Synthetic cleanup failure")
      return remove(id)
    }
    chrome.downloads.download = async (options) => {
      api.downloadCalls++
      if (mode === "sanitize") api.html = await (await read(options.url)).text()
      if (mode === "pending-id") await gate()
      const id = await download(options)
      api.id = id
      if (mode === "completed-id" || mode === "cleanup-error") {
        while ((await chrome.downloads.search({ id }))[0]?.state !== "complete")
          await new Promise((r) => setTimeout(r, 20))
        await gate()
      }
      return id
    }
  })
  for (const mode of [
    "sanitize",
    "resources",
    "pending-id",
    "completed-id",
    "cleanup-error",
  ]) {
    await page.goto(
      "https://research.google/deepreview/documents/demo-document-demo-one",
    )
    if (mode === "sanitize")
      await page
        .locator(".comment-body")
        .last()
        .evaluate((el) => {
          const a = document.createElement("a")
          const url = new URL(
            "https://reference.invalid/paper?token=example#section",
          )
          url.username = "sample"
          url.password = "example"
          a.href = url.href
          a.setAttribute("ping", "https://reference.invalid/ping")
          a.dataset.privateNote = "example"
          a.textContent = "Synthetic reference"
          el.append(a)
        })
    const sourceId = await worker.evaluate(
      async (url) =>
        (await chrome.tabs.query({})).find((t) => t.url === url).id,
      page.url(),
    )
    const pending = context.waitForEvent("page")
    await worker.evaluate(
      async ({ sourceId, mode }) =>
        chrome.tabs.create({
          url:
            chrome.runtime.getURL("export.html") +
            "?sourceTabId=" +
            sourceId +
            "&auditMode=" +
            mode,
          active: false,
        }),
      { sourceId, mode },
    )
    const task = await pending
    const errors = []
    task.on("pageerror", (e) => errors.push(e.message))
    if (mode === "sanitize") {
      await task.waitForFunction(
        () => document.documentElement.dataset.exportComplete === "true",
      )
      const result = await task.evaluate(() => {
        const t = document.createElement("template")
        t.innerHTML = globalThis.audit.html
        const links = [
          ...t.content.querySelectorAll(
            "[data-margin-card-id] .comment-body a",
          ),
        ]
        return {
          clean:
            links.some(
              (a) =>
                a.getAttribute("href") === "https://reference.invalid/paper",
            ) &&
            links.every(
              (a) =>
                !a.hasAttribute("ping") && !a.hasAttribute("data-private-note"),
            ),
          noCredential: !globalThis.audit.html.includes("sample:example"),
          noQuery: !globalThis.audit.html.includes("token=example"),
        }
      })
      assert(
        result.clean && result.noCredential && result.noQuery && !errors.length,
        "Actual capture/render path retained private URL/attributes",
      )
      records.push({
        name: "Actual production capture/render reference cleanup",
        passed: true,
      })
      await task.close()
      continue
    }
    await task.waitForFunction(() => globalThis.audit?.waiting === true)
    await task.locator("#cancel").click()
    await task.evaluate(() => globalThis.audit.release())
    if (mode === "resources") await task.waitForTimeout(300)
    else if (mode === "cleanup-error")
      await task.waitForFunction(() =>
        document
          .getElementById("status")
          .textContent.includes("Synthetic cleanup failure"),
      )
    else
      await task.waitForFunction(async () => {
        const a = globalThis.audit
        if (!a.cancelIds.length) return false
        const [item] = await chrome.downloads.search({ id: a.id })
        return item.state === "interrupted" || item.exists === false
      })
    const result = await task.evaluate(() => ({
      calls: globalThis.audit.downloadCalls,
      id: globalThis.audit.id,
      cancelIds: globalThis.audit.cancelIds,
      removeIds: globalThis.audit.removeIds,
      heading: document.getElementById("heading").textContent,
      success: document.documentElement.dataset.exportComplete,
      cancelHidden: document.getElementById("cancel").hidden,
    }))
    assert(
      !result.success && result.cancelHidden && !errors.length,
      `Cancellation UI/exception failed: ${mode}`,
    )
    if (mode === "resources")
      assert(result.calls === 0, "Canceled render still requested a download")
    else
      assert(
        result.cancelIds.length &&
          result.cancelIds.every((id) => id === result.id) &&
          result.removeIds.every((id) => id === result.id),
        "Cancellation touched a different download",
      )
    if (mode === "cleanup-error")
      await worker.evaluate(
        async (id) => chrome.downloads.removeFile(id),
        result.id,
      )
    records.push({
      name: `Cancel at ${mode}`,
      passed: true,
      errors: errors.length,
    })
    await task.close()
  }
  return {
    success: true,
    checks: records,
    scope:
      "Synthetic data and isolated test-copy extension only; no real Google credentials or review fetched",
  }
}
