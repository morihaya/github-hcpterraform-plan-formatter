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
          
          text = text.replace(/Terraform Cloud\/[^/]+\//, '');
          
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
                  
                  const workspaceMatch = titleContent.match(/Terraform Cloud\/[^/]+\/(.+?)\s+Terraform plan:/);
                  if (workspaceMatch) {
                    const cleanWorkspace = workspaceMatch[1].trim();
                    workspaceLink = `<a href="${hrefMatch[1]}" target="_blank">${cleanWorkspace}</a>`;
                  } else {
                    const workspaceFromText = text.substring(0, text.indexOf('Terraform plan:')).trim();
                    const cleanWorkspace = workspaceFromText.replace(/[—\-]\s*.*$/, '').trim();
                    workspaceLink = `<a href="${hrefMatch[1]}" target="_blank">${cleanWorkspace}</a>`;
                  }
                }
              }
              
              const finalHTML = `
                <span class="terraform-plan-line">${workspaceLink}</span>
                <span class="terraform-plan-line">Terraform plan: ${coloredAdd}, ${coloredChange}, ${coloredDestroy}</span>
              `;
              
              el.innerHTML = `<span class="terraform-plan-result">${finalHTML}</span>`;
              processed++;
            } else {
              const workspacePart = text.substring(0, text.indexOf('Terraform plan:')).trim();
              const workspaceName = workspacePart.replace(/[—\-\s]+$/, '').trim();
              
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
              
              const coloredHTML = `<span class="terraform-plan-result">
                ${workspaceName ? `<span class="terraform-plan-line">${workspaceName}</span>` : ''}
                <span class="terraform-plan-line">Terraform plan: ${coloredAdd}, ${coloredChange}, ${coloredDestroy}</span>
              </span>`;
              
              el.innerHTML = coloredHTML;
              processed++;
            }
          } else {
            if (text !== el.textContent) {
              el.textContent = text;
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