/** Run the standalone viewer: linked navigation, local UI state, zoom, copy and language. */
(() => {
  "use strict";
  // DOM references are shared by selection, zoom and accessible keyboard events.
  const pdf = document.getElementById("pdf-pane");
  const feedback = document.getElementById("feedback-pane");
  const commentsView = document.getElementById("comments-view");
  const reportView = document.getElementById("report-view");
  const workspace = document.querySelector(".figma-split-workspace");
  const summary = document.getElementById("overall-summary-body");
  const summaryCard = commentsView.querySelector(".overall-summary-card");
  const more = commentsView.querySelector(".read-more-btn");
  const toggle = document.querySelector(".view-mode-toggle-btn");
  const filter = document.getElementById("severity-filter");
  const restore = document.getElementById("restore-dismissed");
  const copy = document.querySelector(".copy-report-btn");
  const status = document.getElementById("offline-status");
  const cards = [...commentsView.querySelectorAll("[data-margin-card-id]")];
  const highlights = [...pdf.querySelectorAll("[data-comment-id]")];
  const sections = [...reportView.querySelectorAll("[data-report-comment-id]")];
  // Index both directions once: comment -> rectangles and rectangle -> card.
  const byId = new Map(cards.map((card) => [card.dataset.marginCardId, card]));
  const boxesById = new Map(
    cards.map((card) => [
      card.dataset.marginCardId,
      highlights.filter(
        (box) => box.dataset.commentId === card.dataset.marginCardId,
      ),
    ]),
  );
  const zoomOut = document.querySelector('[aria-label="Zoom out PDF"]');
  const zoomIn = document.querySelector('[aria-label="Zoom in PDF"]');
  const zoomReset = document.querySelector(".zoom-reset-btn");
  // Both language catalogs are embedded in the file; switching never uses a server.
  const translations = {
    en: {
      overall: "Overall Feedback",
      detailed: "Detailed Feedback",
      report: "View as Report",
      comments: "View as Comments",
      more: "Read more",
      less: "Read less",
      copy: "Copy Report",
      copied: "Copied",
      unavailable: "Copy unavailable",
      dismiss: "Dismiss",
      restore: "Restore dismissed",
      all: "All Types",
      critical: "Critical",
      major: "Major",
      minor: "Minor",
      suggestion: "Suggestion",
      default: "Feedback",
      zoomOut: "Zoom out PDF",
      zoomIn: "Zoom in PDF",
      zoomReset: "Reset PDF zoom to 100%",
      language: "Viewer language",
      filter: "Filter comment types",
      selected: "Selected",
      reportView: "Report view",
      commentsView: "Comments view",
      dismissed: "Feedback dismissed. Use Restore dismissed to show it again.",
      restored: "Dismissed feedback restored",
      zoom: "PDF zoom",
      copySuccess: "Full review report copied",
      copyFailed:
        "Clipboard access unavailable. Select and copy the report text.",
      pdf: "Annotated PDF document",
      feedback: "Review feedback",
      fullReport: "Full review report",
      zoomControls: "PDF zoom controls",
      page: "Page",
    },
    ko: {
      overall: "전체 피드백",
      detailed: "상세 피드백",
      report: "보고서로 보기",
      comments: "코멘트로 보기",
      more: "더 보기",
      less: "접기",
      copy: "보고서 복사",
      copied: "복사됨",
      unavailable: "복사할 수 없음",
      dismiss: "숨기기",
      restore: "숨긴 항목 복원",
      all: "모든 유형",
      critical: "치명적",
      major: "주요",
      minor: "경미",
      suggestion: "제안",
      default: "피드백",
      zoomOut: "논문 축소",
      zoomIn: "논문 확대",
      zoomReset: "논문 배율 100%로 초기화",
      language: "뷰어 언어",
      filter: "코멘트 유형 필터",
      selected: "선택됨",
      reportView: "보고서 보기",
      commentsView: "코멘트 보기",
      dismissed:
        "피드백을 숨겼습니다. 숨긴 항목 복원으로 다시 표시할 수 있습니다.",
      restored: "숨긴 피드백을 복원했습니다",
      zoom: "논문 배율",
      copySuccess: "전체 보고서를 복사했습니다",
      copyFailed:
        "클립보드에 접근할 수 없습니다. 보고서 본문을 선택해 복사해 주세요.",
      pdf: "하이라이트가 있는 논문",
      feedback: "리뷰 피드백",
      fullReport: "전체 리뷰 보고서",
      zoomControls: "논문 확대·축소",
      page: "페이지",
    },
  };
  // Language changes labels only; the captured paper and review text stay untouched.
  let language = document.documentElement.lang === "ko" ? "ko" : "en";
  const t = (key) => translations[language][key];
  // Create the selector here so the optional legacy saved-page importer also works.
  const languagePicker = document.createElement("select");
  languagePicker.id = "viewer-language";
  for (const [value, label] of [
    ["en", "English"],
    ["ko", "한국어"],
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    languagePicker.append(option);
  }
  toggle.before(languagePicker);
  // Session-only UI state; nothing is written to browser storage or a server.
  const state = {
    mode: "comments",
    selected: null,
    zoom: 100,
    dismissed: new Set(),
    summaryDismissed: false,
    scroll: { comments: 0, report: 0 },
  };
  const behavior = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  let announceTimer;
  /** Defer live-region text so repeated selections are announced again. */
  function announce(message) {
    status.textContent = "";
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      status.textContent = message;
    }, 20);
  }
  /** Scroll only the relevant pane, preserving the other pane's position. */
  function scrollPane(pane, target, horizontal = false) {
    const parent = pane.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const top = pane.scrollTop + rect.top - parent.top - 20;
    const left = horizontal
      ? pane.scrollLeft +
        rect.left -
        parent.left -
        Math.max(20, (pane.clientWidth - rect.width) / 2)
      : pane.scrollLeft;
    pane.scrollTo({
      top: Math.max(0, top),
      left: Math.max(0, left),
      behavior: behavior(),
    });
  }
  /** Remember independent Comments and Report scroll positions. */
  function setMode(mode, remember = true) {
    if (mode === state.mode) return;
    if (remember) state.scroll[state.mode] = feedback.scrollTop;
    state.mode = mode;
    const report = mode === "report";
    commentsView.hidden = report;
    reportView.hidden = !report;
    feedback.classList.toggle("report-mode", report);
    toggle.classList.toggle("active-mode", report);
    toggle.setAttribute("aria-pressed", String(report));
    toggle.querySelector(".mdc-button__label").textContent = report
      ? t("comments")
      : t("report");
    toggle.setAttribute(
      "aria-controls",
      report ? "report-view" : "comments-view",
    );
    feedback.scrollTop = state.scroll[mode];
    announce(report ? t("reportView") : t("commentsView"));
  }
  /** Apply filtering and dismissal to cards and their associated rectangles. */
  function refreshVisibility() {
    for (const card of cards) {
      card.hidden =
        state.dismissed.has(card.dataset.marginCardId) ||
        (filter.value !== "ALL" && filter.value !== card.dataset.severity);
    }
    for (const box of highlights)
      box.hidden = byId.get(box.dataset.commentId).hidden;
    for (const section of sections)
      section.hidden = state.dismissed.has(section.dataset.reportCommentId);
    summaryCard.hidden = state.summaryDismissed;
    const n = state.dismissed.size + Number(state.summaryDismissed);
    restore.hidden = n === 0;
    restore.textContent = `${t("restore")} (${n})`;
  }
  /** Reveal a selected target, update all matching regions, then move focus. */
  function selectComment(id, origin) {
    const card = byId.get(id);
    if (!card) return;
    state.dismissed.delete(id);
    if (filter.value !== "ALL" && filter.value !== card.dataset.severity)
      filter.value = "ALL";
    refreshVisibility();
    state.selected = id;
    summaryCard.classList.remove("selected");
    for (const item of cards) {
      const selected = item === card;
      item.classList.toggle("selected", selected);
      if (selected) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    }
    for (const box of highlights) {
      const selected = box.dataset.commentId === id;
      box.classList.toggle("selected", selected);
      box.setAttribute("aria-pressed", String(selected));
    }
    for (const section of sections)
      section.classList.toggle(
        "selected",
        section.dataset.reportCommentId === id,
      );
    if (origin === "highlight") {
      setMode("comments");
      card.focus({ preventScroll: true });
      scrollPane(feedback, card);
    } else {
      const target = boxesById.get(id)[0];
      target.focus({ preventScroll: true });
      scrollPane(pdf, target, true);
    }
    announce(`${t("selected")}: ${card.getAttribute("aria-label")}`);
  }
  /** Nested links/buttons and selecting text should not select a comment. */
  function isControl(event) {
    return (
      event.target.closest("a, button, select, input, textarea") ||
      (event.type === "click" && String(getSelection()).trim().length > 0)
    );
  }
  // Delegate pointer and keyboard input so every linked rectangle uses the same path.
  pdf.addEventListener("click", (event) => {
    const box = event.target.closest("[data-comment-id]");
    if (box) selectComment(box.dataset.commentId, "highlight");
  });
  pdf.addEventListener("keydown", (event) => {
    const box = event.target.closest("[data-comment-id]");
    if (box && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      selectComment(box.dataset.commentId, "highlight");
    }
  });
  // Buttons keep their own actions; clicking a non-control card selects its passage.
  feedback.addEventListener("click", (event) => {
    const dismiss = event.target.closest(".figma-dismiss-btn");
    if (dismiss) {
      const card = dismiss.closest("[data-margin-card-id]");
      if (card) state.dismissed.add(card.dataset.marginCardId);
      else state.summaryDismissed = true;
      refreshVisibility();
      announce(t("dismissed"));
      return;
    }
    if (isControl(event)) return;
    const card = event.target.closest(
      "[data-margin-card-id], [data-report-comment-id]",
    );
    if (card)
      selectComment(
        card.dataset.marginCardId || card.dataset.reportCommentId,
        "comment",
      );
  });
  feedback.addEventListener("keydown", (event) => {
    const card = event.target.closest(
      "[data-margin-card-id], [data-report-comment-id]",
    );
    if (card && event.target === card && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      selectComment(
        card.dataset.marginCardId || card.dataset.reportCommentId,
        "comment",
      );
    }
  });
  // Collapse only the summary; the complete body remains available for reports/copy.
  more.addEventListener("click", () => {
    const collapsed = summary.classList.toggle("collapsed");
    more.querySelector(".mdc-button__label").textContent = collapsed
      ? t("more")
      : t("less");
    more.setAttribute("aria-expanded", String(!collapsed));
    if (
      collapsed &&
      summaryCard.getBoundingClientRect().top <
        feedback.getBoundingClientRect().top
    ) {
      scrollPane(
        feedback,
        commentsView.querySelector(".overall-card-title-row") || summaryCard,
      );
    }
  });
  toggle.addEventListener("click", () =>
    setMode(state.mode === "comments" ? "report" : "comments"),
  );
  filter.addEventListener("change", refreshVisibility);
  restore.addEventListener("click", () => {
    state.dismissed.clear();
    state.summaryDismissed = false;
    refreshVisibility();
    announce(t("restored"));
  });
  /** Preserve the point near the viewport center while image geometry scales. */
  function zoomTo(value) {
    value = Math.max(50, Math.min(500, value));
    if (value === state.zoom) return;
    const paneRect = pdf.getBoundingClientRect();
    const centerY = paneRect.top + pdf.clientHeight * 0.4;
    const centerX = paneRect.left + pdf.clientWidth / 2;
    const page =
      [...pdf.querySelectorAll("[data-page-number]")].find(
        (el) => el.getBoundingClientRect().bottom > centerY,
      ) || pdf.querySelector("[data-page-number]");
    const before = page.getBoundingClientRect();
    // Ratios identify the same image point before and after the layout change.
    const y = (centerY - before.top) / before.height;
    const x = (centerX - before.left) / before.width;
    state.zoom = value;
    workspace.style.setProperty("--pat-pdf-width", `${(640 * value) / 100}px`);
    workspace.style.setProperty("--pat-manuscript-scale", String(value / 100));
    zoomReset.textContent = `${value}%`;
    zoomOut.disabled = value === 50;
    zoomIn.disabled = value === 500;
    requestAnimationFrame(() => {
      const after = page.getBoundingClientRect();
      pdf.scrollTop += after.top + y * after.height - centerY;
      pdf.scrollLeft += after.left + x * after.width - centerX;
    });
    announce(`${t("zoom")} ${value}%`);
  }
  zoomOut.addEventListener("click", () => zoomTo(state.zoom - 10));
  zoomIn.addEventListener("click", () => zoomTo(state.zoom + 10));
  zoomReset.addEventListener("click", () => zoomTo(100));
  // Reset the temporary copy result after showing accessible success/failure feedback.
  let copyTimer;
  copy.addEventListener("click", async () => {
    // Both modes copy the full, same-snapshot report, regardless of filtering/dismissal.
    // Work on a detached clone so copying never changes the visible review.
    const clone = reportView.cloneNode(true);
    clone
      .querySelectorAll("[hidden]")
      .forEach((el) => el.removeAttribute("hidden"));
    clone.querySelectorAll("[data-xpm-copy-root]").forEach((el) => {
      const math = el.closest("[data-latex]");
      if (math) math.textContent = math.dataset.latex;
    });
    clone
      .querySelectorAll("p, h2, h3, h4, li, section")
      .forEach((el) => el.append(document.createTextNode("\n")));
    const text = clone.textContent
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    let success = false;
    try {
      await navigator.clipboard.writeText(text);
      success = true;
    } catch (_) {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.append(input);
      input.select();
      success = document.execCommand("copy");
      input.remove();
      copy.focus({ preventScroll: true });
    }
    clearTimeout(copyTimer);
    copy.querySelector(".mdc-button__label").textContent = success
      ? t("copied")
      : t("unavailable");
    copy.classList.toggle("copied", success);
    announce(success ? t("copySuccess") : t("copyFailed"));
    copyTimer = setTimeout(() => {
      copy.querySelector(".mdc-button__label").textContent = t("copy");
      copy.classList.remove("copied");
    }, 2000);
  });
  /** Translate interface labels only; never translate or rewrite review content. */
  function applyLanguage() {
    document.documentElement.lang = language;
    languagePicker.value = language;
    languagePicker.setAttribute("aria-label", t("language"));
    const label = (button, key) => {
      button.querySelector(".mdc-button__label").textContent = t(key);
    };
    label(toggle, state.mode === "report" ? "comments" : "report");
    label(more, summary.classList.contains("collapsed") ? "more" : "less");
    label(copy, "copy");
    for (const button of document.querySelectorAll(".figma-dismiss-btn"))
      label(button, "dismiss");
    for (const el of document.querySelectorAll(
      ".overall-card-heading, .offline-report-summary > h2",
    ))
      el.textContent = t("overall");
    for (const el of document.querySelectorAll(
      ".detailed-feedback-badge, #report-view > h2",
    ))
      el.textContent = t("detailed");
    for (const option of filter.options)
      option.textContent = t(option.value === "ALL" ? "all" : option.value);
    for (const badge of document.querySelectorAll(".severity-badge")) {
      const severity = [...badge.classList]
        .find((c) =>
          /^severity-(critical|major|minor|suggestion|default)$/.test(c),
        )
        ?.slice(9);
      if (severity) badge.textContent = t(severity);
    }
    filter.setAttribute("aria-label", t("filter"));
    zoomOut.setAttribute("aria-label", t("zoomOut"));
    zoomIn.setAttribute("aria-label", t("zoomIn"));
    zoomReset.setAttribute("aria-label", t("zoomReset"));
    document
      .querySelector(".pdf-zoom-controls")
      .setAttribute("aria-label", t("zoomControls"));
    pdf.setAttribute("aria-label", t("pdf"));
    feedback.setAttribute("aria-label", t("feedback"));
    reportView.setAttribute("aria-label", t("fullReport"));
    for (const img of pdf.querySelectorAll("img"))
      img.alt = `${t("page")} ${img.closest("[data-page-number]").dataset.pageNumber}`;
    refreshVisibility();
  }
  languagePicker.addEventListener("change", () => {
    language = languagePicker.value === "ko" ? "ko" : "en";
    applyLanguage();
  });
  applyLanguage();
  document.documentElement.dataset.viewerReady = "true";
})();
