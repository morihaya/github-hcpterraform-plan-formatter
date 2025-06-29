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
        // Skip if already processed or if it's a terraform-plan-result element
        if (el.dataset.terraformFormatted === 'true' || el.classList.contains('terraform-plan-result')) {
          return;
        }

        // Skip if this element contains a terraform-plan-result (already processed by a child)
        if (el.querySelector('.terraform-plan-result')) {
          return;
        }

        // Skip if parent element already has terraform-plan-result
        if (el.closest('.terraform-plan-result')) {
          return;
        }

        // Only process elements that contain both workspace name and plan
        if (el.textContent && el.textContent.includes('Terraform Cloud/') && el.textContent.includes('Terraform plan:')) {
          let text = el.textContent;
          const originalHTML = el.innerHTML;

          // Extract workspace name more carefully
          let workspaceDisplayName = '';

          // First try to extract from HTML if it contains a link
          if (originalHTML.includes('Terraform Cloud/')) {
            // Try to extract from span elements or link text
            const spanMatch = originalHTML.match(/<span[^>]*>Terraform Cloud\/([^/]+)\/([^<]+)<\/span>/);
            const linkTextMatch = originalHTML.match(/Terraform Cloud\/([^/]+)\/([^<>"'\s,]+)/);

            if (spanMatch && spanMatch[2]) {
              workspaceDisplayName = spanMatch[2].trim();
              console.log('Debug - Extracted from span:', workspaceDisplayName);
            } else if (linkTextMatch && linkTextMatch[2]) {
              workspaceDisplayName = linkTextMatch[2].trim();
              console.log('Debug - Extracted from link text:', workspaceDisplayName);
            }
          }

          // If not found in HTML, try text patterns
          if (!workspaceDisplayName) {
            // Debug: log the original text
            console.log('Debug - Original text:', text);

            // Try multiple patterns to extract workspace name
            const patterns = [
              /Terraform Cloud\/([^/]+)\/([^/\s\-—\r\n]+)/,  // More precise pattern to avoid separators
              /Terraform Cloud\/([^/]+)\/(.+?)(?=\s*[-—]|\s*Terraform plan:|\s*$)/,
              /Terraform Cloud\/[^/]+\/([^/\s\-—\r\n]+)/
            ];

            for (const pattern of patterns) {
              const match = text.match(pattern);
              if (match) {
                // Use the last capture group that contains the workspace name
                workspaceDisplayName = (match[2] || match[1]).trim();
                // Additional cleanup: remove any trailing separators or whitespace
                workspaceDisplayName = workspaceDisplayName.replace(/[-—\s]+$/, '').trim();

                // Validate that the workspace name is not empty or just separators
                if (workspaceDisplayName && !/^[-—\s]*$/.test(workspaceDisplayName)) {
                  console.log('Debug - Extracted workspace name:', workspaceDisplayName);
                  break;
                } else {
                  workspaceDisplayName = '';
                }
              }
            }
          }

          // If still no workspace name, try a simpler extraction
          if (!workspaceDisplayName && text.includes('Terraform Cloud/')) {
            const parts = text.split('Terraform Cloud/')[1];
            if (parts) {
              const pathParts = parts.split('/');
              if (pathParts.length >= 2) {
                workspaceDisplayName = pathParts.slice(1).join('/').split(/\s+/)[0];
                // Remove any separators
                workspaceDisplayName = workspaceDisplayName.replace(/[-—\s]+.*$/, '');
                console.log('Debug - Fallback workspace name:', workspaceDisplayName);
              }
            }
          }

          // Final check: make sure workspace name is not just a separator or invalid
          if (workspaceDisplayName && (/^[-—\s]*$/.test(workspaceDisplayName) || workspaceDisplayName === '—')) {
            workspaceDisplayName = '';
            console.log('Debug - Rejected invalid workspace name');
          }

          // If we still don't have a valid workspace name, try to extract from title attribute
          if (!workspaceDisplayName && originalHTML.includes('title=')) {
            const titleMatch = originalHTML.match(/title="([^"]*Terraform Cloud\/[^/]+\/[^"]*?)"/);
            if (titleMatch) {
              const titleContent = titleMatch[1];
              const titleWorkspaceMatch = titleContent.match(/Terraform Cloud\/[^/]+\/([^\s]+)/);
              if (titleWorkspaceMatch && titleWorkspaceMatch[1]) {
                workspaceDisplayName = titleWorkspaceMatch[1].trim();
                console.log('Debug - Extracted from title:', workspaceDisplayName);
              }
            }
          }

          // Replace the full Terraform Cloud path with just the workspace name
          if (workspaceDisplayName) {
            // Remove the entire original Terraform Cloud line and any separators
            text = text.replace(/Terraform Cloud\/[^/]+\/[^\r\n]*[-—\s]*\r?\n?/g, '');
            text = text.replace(/^[-—\s]*\r?\n?/gm, ''); // Remove separator lines
            text = text.trim();
          }

          const planMatch = text.match(/Terraform plan:\s*(\d+)\s*to add,\s*(\d+)\s*to change,\s*(\d+)\s*to destroy/);

          if (planMatch) {
            const [, add, change, destroy] = planMatch;

            // Completely replace the element content to avoid showing original text
            el.style.display = 'block';

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

              const finalHTML = `<div class="terraform-plan-line">${workspaceLink || 'Terraform Workspace'}</div><div class="terraform-plan-line">Terraform plan: ${coloredAdd}, ${coloredChange}, ${coloredDestroy}</div>`;

              // Clear existing content and set new content
              el.innerHTML = '';
              el.innerHTML = `<div class="terraform-plan-result">${finalHTML}</div>`;
              el.style.whiteSpace = 'normal';
              processed++;
            } else {
              // For non-link elements, use the extracted workspace name
              const workspaceName = workspaceDisplayName || text.substring(0, text.indexOf('Terraform plan:')).trim();

              console.log('Debug - Final workspace name for display:', workspaceName);

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

              const coloredHTML = `<div class="terraform-plan-result">${workspaceName && workspaceName.length > 0 ? `<div class="terraform-plan-line">${workspaceName}</div>` : `<div class="terraform-plan-line">Terraform Workspace</div>`}<div class="terraform-plan-line">Terraform plan: ${coloredAdd}, ${coloredChange}, ${coloredDestroy}</div></div>`;

              // Clear existing content and set new content
              el.innerHTML = '';
              el.innerHTML = coloredHTML;
              el.style.whiteSpace = 'normal';
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
