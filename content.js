(function () {
  "use strict";

  let debounceTimer = null;

  function formatTerraformResults() {

    const ciCheckTitleSelectors = [
      "div.TimelineItem strong",
      "ul li div a span",
      "span[class*='titleDescription']",
      "*[class*='StatusCheckRow']",
    ];

    let processed = 0;

    ciCheckTitleSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (el.dataset.terraformFormatted === 'true') {
          return;
        }

        if (el.textContent && (el.textContent.includes('Terraform plan:') || el.textContent.includes('Terraform Cloud/'))) {
          let text = el.textContent;
          const originalHTML = el.innerHTML;

          // Extract workspace name more carefully
          let workspaceDisplayName = '';
          const terraformCloudMatch = text.match(/Terraform Cloud\/([^/]+)\/(.+?)(?:\s+[-—]?\s*Terraform plan:|Terraform plan:)/);
          if (terraformCloudMatch) {
            // [1] is organization, [2] is workspace name
            workspaceDisplayName = terraformCloudMatch[2].trim();
            // Replace the full Terraform Cloud path with just the workspace name
            text = text.replace(/Terraform Cloud\/[^/]+\/[^\s]+/, workspaceDisplayName);
          }

          const planMatch = text.match(/Terraform plan:\s*(\d+)\s*to add,\s*(\d+)\s*to change,\s*(\d+)\s*to destroy/);

          if (planMatch) {
            const [, add, change, destroy] = planMatch;

            if (originalHTML.includes('<a ') && originalHTML.includes('href=')) {

              const createColoredSentence = (count, type, action) => {
                const num = parseInt(count);
                const highlightClass = num > 0 ? ' highlight' : '';
                const countSpan = `<span class="terraform-count ${type}${highlightClass}">${count}</span>`;

                if (num > 0) {
                  return `<span class="terraform-sentence highlight">${countSpan} to ${action}</span>`;
                } else {
                  return `${countSpan} to ${action}`;
                }
              };

              const coloredAdd = createColoredSentence(add, 'add', 'add');
              const coloredChange = createColoredSentence(change, 'change', 'change');
              const coloredDestroy = createColoredSentence(destroy, 'destroy', 'destroy');


              const linkMatch = originalHTML.match(/<a[^>]*href="[^"]*"[^>]*>.*?<\/a>/s);
              let workspaceLink = '';

              if (linkMatch) {


                const titleMatch = linkMatch[0].match(/title="([^"]*)"/);
                const hrefMatch = linkMatch[0].match(/href="([^"]*)"/);

                if (titleMatch && hrefMatch) {
                  const titleContent = titleMatch[1];

                  // Extract workspace name from title more carefully
                  const workspaceMatch = titleContent.match(/Terraform Cloud\/([^/]+)\/(.+?)(?:\s+[-—]?\s*Terraform plan:|$)/);
                  if (workspaceMatch) {
                    const cleanWorkspace = workspaceMatch[2].trim();
                    workspaceLink = `<a href="${hrefMatch[1]}" target="_blank">${cleanWorkspace}</a>`;
                  } else {
                    // Fallback: use the workspace name we extracted earlier
                    const cleanWorkspace = workspaceDisplayName || text.substring(0, text.indexOf('Terraform plan:')).trim();
                    workspaceLink = `<a href="${hrefMatch[1]}" target="_blank">${cleanWorkspace}</a>`;
                  }
                }
              }

              const finalHTML = `<div class="terraform-plan-line">${workspaceLink}</div><div class="terraform-plan-line">Terraform plan: ${coloredAdd}, ${coloredChange}, ${coloredDestroy}</div>`;

              el.innerHTML = `<div class="terraform-plan-result">${finalHTML}</div>`;
              processed++;
            } else {
              // For non-link elements, use the extracted workspace name
              const workspaceName = workspaceDisplayName || text.substring(0, text.indexOf('Terraform plan:')).trim();

              const createColoredSentence = (count, type, action) => {
                const num = parseInt(count);
                const highlightClass = num > 0 ? ' highlight' : '';
                const countSpan = `<span class="terraform-count ${type}${highlightClass}">${count}</span>`;

                if (num > 0) {
                  return `<span class="terraform-sentence highlight">${countSpan} to ${action}</span>`;
                } else {
                  return `${countSpan} to ${action}`;
                }
              };

              const coloredAdd = createColoredSentence(add, 'add', 'add');
              const coloredChange = createColoredSentence(change, 'change', 'change');
              const coloredDestroy = createColoredSentence(destroy, 'destroy', 'destroy');

              const coloredHTML = `<div class="terraform-plan-result">${workspaceName ? `<div class="terraform-plan-line">${workspaceName}</div>` : ''}<div class="terraform-plan-line">Terraform plan: ${coloredAdd}, ${coloredChange}, ${coloredDestroy}</div></div>`;

              el.innerHTML = coloredHTML;
              processed++;
            }
          }

          el.dataset.terraformFormatted = 'true';
        }
      });
    });

  }

  function handlePageLoadOrTransition() {
    formatTerraformResults();
  }

  document.addEventListener("turbo:load", handlePageLoadOrTransition);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", handlePageLoadOrTransition);
  } else {
    handlePageLoadOrTransition();
  }

  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      setTimeout(handlePageLoadOrTransition, 300);
    } else {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(formatTerraformResults, 150);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.body.addEventListener("click", function (event) {
    const potentialButton = event.target.closest(
      'button, summary, [role="button"]'
    );

    if (potentialButton) {
      setTimeout(formatTerraformResults, 300);
    }
  });
})();
