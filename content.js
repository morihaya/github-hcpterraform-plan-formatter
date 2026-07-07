// GitHub HCP Terraform Plan Formatter - content script
//
// Detects HCP Terraform (formerly Terraform Cloud) status-check titles on
// GitHub PR pages and reformats them:
//   "HCP Terraform/<org>/<workspace> — Terraform plan: 1 to add, ..."
// becomes a two-line, color-coded summary with the org prefix removed.
//
// Detection is primarily text-based (TreeWalker over text nodes) so it keeps
// working when GitHub changes its DOM structure / CSS module class names.
(function () {
  "use strict";

  const RESULT_CLASS = "terraform-plan-result";
  const LINE_CLASS = "terraform-plan-line";

  const PR_PATH_RE = /\/pull\/\d+/;

  // "HCP Terraform/<org>/<workspace>" or legacy "Terraform Cloud/<org>/<workspace>"
  const PROVIDER_PATH_RE = /(?:HCP Terraform|Terraform Cloud)\/([^/\s]+)\/(\S+)/;
  const PROVIDER_PREFIX_RE = /(?:HCP Terraform|Terraform Cloud)\/[^/\s]+\//;
  const PLAN_COUNTS_RE =
    /Terraform plan:\s*(\d+)\s*to add,\s*(\d+)\s*to change,\s*(\d+)\s*to destroy/;
  const NO_CHANGES_RE = /no changes/i;
  const CANDIDATE_TEXT_RE = /Terraform plan|(?:HCP Terraform|Terraform Cloud)\//;

  // Known containers for check titles in past/current GitHub layouts. These
  // are only cheap hints; the text-node scan below is the primary detection.
  const KNOWN_SELECTORS = [
    "div.TimelineItem strong",
    "span[class*='titleDescription']",
    "*[class*='StatusCheckRow']",
  ];

  // Never read from or write into these: GitHub embeds JSON payloads in
  // <script> tags that also mention check names.
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA"]);

  function isSkippedTextNode(node) {
    const parent = node.parentElement;
    return !parent || SKIP_TAGS.has(parent.tagName);
  }

  // textContent of an element excluding script/style/etc. text.
  function visibleText(el) {
    if (SKIP_TAGS.has(el.tagName)) return "";
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        isSkippedTextNode(node)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    let out = "";
    while (walker.nextNode()) out += walker.currentNode.data;
    return out;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  // --- Parsing --------------------------------------------------------------

  function extractWorkspaceName(el, text) {
    // The title attribute of the check link holds the untruncated path, so
    // prefer it over the (possibly ellipsized) visible text.
    const link = el.querySelector("a[title]");
    const sources = [link && link.getAttribute("title"), text];
    for (const source of sources) {
      if (!source) continue;
      const match = source.match(PROVIDER_PATH_RE);
      if (match) {
        const name = match[2].replace(/[-—,.\s]+$/, "");
        if (name) return name;
      }
    }
    return "";
  }

  // --- Rendering ------------------------------------------------------------

  function renderCount(count, action) {
    const highlight = count > 0 ? " highlight" : "";
    const span = `<span class="terraform-count ${action}${highlight}">${count}</span> to ${action}`;
    return count > 0
      ? `<span class="terraform-sentence highlight">${span}</span>`
      : span;
  }

  function buildResultHtml(workspaceName, href, plan) {
    const planLine =
      plan === "no-changes"
        ? "Terraform plan: No changes"
        : `Terraform plan: ${renderCount(plan.add, "add")}, ${renderCount(
            plan.change,
            "change"
          )}, ${renderCount(plan.destroy, "destroy")}`;

    let nameLine = "";
    if (workspaceName) {
      const escapedName = escapeHtml(workspaceName);
      const nameHtml = href
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapedName}</a>`
        : escapedName;
      nameLine = `<div class="${LINE_CLASS}">${nameHtml}</div>`;
    }

    return `<div class="${RESULT_CLASS}">${nameLine}<div class="${LINE_CLASS}">${planLine}</div></div>`;
  }

  // Shorten "<provider>/<org>/<workspace>" to just the workspace name inside
  // text nodes, without touching the surrounding markup (links stay intact).
  function stripProviderPrefix(el) {
    let changed = false;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        isSkippedTextNode(node)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (PROVIDER_PREFIX_RE.test(node.data)) {
        node.data = node.data.replace(PROVIDER_PREFIX_RE, "");
        changed = true;
      }
    }
    return changed;
  }

  // Descend to the smallest element that still contains the plan summary, so
  // sibling controls (e.g. the "Details" link in a check row) are preserved.
  function narrowToSummary(el, summaryRe) {
    let current = el;
    for (;;) {
      const child = Array.from(current.children).find(
        (c) => !SKIP_TAGS.has(c.tagName) && summaryRe.test(visibleText(c))
      );
      if (!child || child.classList.contains(RESULT_CLASS)) break;
      current = child;
    }
    return current;
  }

  // --- Formatting -----------------------------------------------------------

  function formatElement(el) {
    if (!el || !el.isConnected) return 0;
    if (el.dataset.terraformFormatted === "true") return 0;
    if (el.closest(`.${RESULT_CLASS}`)) return 0;
    if (el.querySelector(`.${RESULT_CLASS}`)) {
      el.dataset.terraformFormatted = "true";
      return 0;
    }

    const text = visibleText(el);
    if (!CANDIDATE_TEXT_RE.test(text)) return 0;

    const countsMatch = text.match(PLAN_COUNTS_RE);
    const hasNoChanges =
      !countsMatch && /Terraform/.test(text) && NO_CHANGES_RE.test(text);

    if (!countsMatch && !hasNoChanges) {
      // No plan summary in this element (e.g. the check-title link while the
      // description lives in a sibling): just drop the long org prefix.
      // Intentionally not marked as formatted so the element is re-examined
      // if the plan summary shows up here later.
      stripProviderPrefix(el);
      return 0;
    }

    const workspaceName = extractWorkspaceName(el, text);
    const target = narrowToSummary(el, countsMatch ? PLAN_COUNTS_RE : NO_CHANGES_RE);
    if (target.dataset.terraformFormatted === "true") return 0;

    // Only render the workspace line when its name actually lives inside the
    // element being rewritten; otherwise it stays visible as a sibling (which
    // stripProviderPrefix below cleans up) and rendering it twice looks odd.
    const targetText = visibleText(target);
    const nameInTarget =
      PROVIDER_PATH_RE.test(targetText) ||
      !!target.querySelector("a[title*='Terraform']");
    const innerLink = target.querySelector("a[href]");
    const href = innerLink ? innerLink.getAttribute("href") : "";

    const plan = countsMatch
      ? {
          add: parseInt(countsMatch[1], 10),
          change: parseInt(countsMatch[2], 10),
          destroy: parseInt(countsMatch[3], 10),
        }
      : "no-changes";

    target.innerHTML = buildResultHtml(
      nameInTarget ? workspaceName : "",
      href,
      plan
    );
    target.style.display = "block";
    target.style.whiteSpace = "normal";
    target.dataset.terraformFormatted = "true";

    if (target !== el) {
      stripProviderPrefix(el);
      // Mark the wrapper too so the DOM reaches a stable state in one pass;
      // freshly re-rendered content inside it is still caught by the
      // text-node scan, which finds elements independently of this mark.
      el.dataset.terraformFormatted = "true";
    }
    return 1;
  }

  // --- Candidate discovery ----------------------------------------------------

  // Climb to the outermost wrapper with identical text so a link and its inner
  // spans are handled as one unit.
  function containerFor(el) {
    let current = el;
    while (
      current.parentElement &&
      current.parentElement !== document.body &&
      current.parentElement.textContent.trim() === current.textContent.trim()
    ) {
      current = current.parentElement;
    }
    return current;
  }

  function collectCandidates() {
    const candidates = new Set();

    // Known layouts first: these containers may hold both the check-title
    // link and the plan description, giving the best formatting result.
    for (const selector of KNOWN_SELECTORS) {
      for (const el of document.querySelectorAll(selector)) {
        if (CANDIDATE_TEXT_RE.test(el.textContent || "")) {
          candidates.add(el);
        }
      }
    }

    // Selector-independent fallback: any text node mentioning a Terraform
    // plan or a provider path, wherever GitHub happens to render it.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        !isSkippedTextNode(node) && CANDIDATE_TEXT_RE.test(node.data)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (!parent || parent.closest(`.${RESULT_CLASS}`)) continue;
      candidates.add(containerFor(parent));
    }

    return candidates;
  }

  // --- Main loop ----------------------------------------------------------------

  let totalFormatted = 0;

  function formatTerraformResults() {
    if (!PR_PATH_RE.test(location.pathname)) return;

    let processed = 0;
    for (const el of collectCandidates()) {
      processed += formatElement(el);
    }

    if (processed > 0) {
      totalFormatted += processed;
      console.debug(
        `🎯 Terraform Plan Formatter: formatted ${processed} element(s)`
      );
      reportProcessed(totalFormatted);
    }
  }

  function reportProcessed(count) {
    try {
      chrome.runtime.sendMessage({ type: "updateBadge", count }, () => {
        // Read lastError so Chrome doesn't log "Unchecked runtime.lastError"
        // when the service worker is asleep or the extension was reloaded.
        void chrome.runtime.lastError;
      });
    } catch {
      // Extension context invalidated (extension updated/reloaded); ignore.
    }
  }

  let debounceTimer = null;

  function scheduleFormat(delay = 200) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(formatTerraformResults, delay);
  }

  // The script is injected on all github.com pages so it also works when the
  // user soft-navigates (Turbo/SPA) into a PR; formatTerraformResults() bails
  // out cheaply on non-PR URLs.
  let lastUrl = location.href;
  const observer = new MutationObserver((mutations) => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      totalFormatted = 0;
      scheduleFormat(300);
      return;
    }
    const relevant = mutations.some((m) => {
      const t = m.target;
      return !(
        t instanceof Element &&
        (t.dataset.terraformFormatted === "true" ||
          t.closest(`.${RESULT_CLASS}`))
      );
    });
    if (relevant) scheduleFormat();
  });

  function start() {
    formatTerraformResults();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("turbo:load", () => scheduleFormat(100));
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
