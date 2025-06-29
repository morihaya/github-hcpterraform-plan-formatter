(function () {
  "use strict";
  
  let debounceTimer = null;

  function formatTerraformResults() {
    console.log('🔍 Terraform Formatter: Starting...');
    
    // 参考拡張機能と同じアプローチを使用
    const ciCheckTitleSelectors = [
      "div.TimelineItem strong", // 通常の GitHub
      "ul li div a span", // GitHub EMU
      "span[class*='titleDescription']", // PR チェック結果
      "*[class*='StatusCheckRow']", // ステータスチェック行
    ];

    let processed = 0;
    
    ciCheckTitleSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        // 既に処理済みかチェック
        if (el.dataset.terraformFormatted === 'true') {
          return;
        }
        
        if (el.textContent && (el.textContent.includes('Terraform plan:') || el.textContent.includes('Terraform Cloud/'))) {
          let text = el.textContent;
          const originalHTML = el.innerHTML;
          
          // 1. "Terraform Cloud/PROJECT/" プレフィックスを削除
          text = text.replace(/Terraform Cloud\/[^/]+\//, '');
          
          // 2. Terraform planの数値を簡潔にフォーマット
          const planMatch = text.match(/Terraform plan:\s*(\d+)\s*to add,\s*(\d+)\s*to change,\s*(\d+)\s*to destroy/);
          
          if (planMatch) {
            const [, add, change, destroy] = planMatch;
            
            // リンクがある場合は、より慎重にHTMLを操作
            if (originalHTML.includes('<a ') && originalHTML.includes('href=')) {
              console.log('🔗 Link detected, using HTML replacement approach');
              
              // カラー表示用のHTML要素を作成（センテンス全体を太字化）
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
              
              // より確実な方法でリンクを保持して2行表示を実現
              console.log('🔧 Original HTML before processing:', originalHTML);
              
              // より複雑なHTML構造に対応したリンク抽出
              const linkMatch = originalHTML.match(/<a[^>]*href="[^"]*"[^>]*>.*?<\/a>/s);
              let workspaceLink = '';
              
              if (linkMatch) {
                console.log('🔗 Raw link match:', linkMatch[0]);
                
                // リンク内のテキストを抽出（spanタグを含む場合も対応）
                const linkInnerMatch = linkMatch[0].match(/>([^<]+)</);
                if (linkInnerMatch) {
                  // linkText = linkInnerMatch[1]; // 未使用のため削除
                } else {
                  // spanタグ内のテキストを抽出
                  const spanMatch = linkMatch[0].match(/<span[^>]*>([^<]+)<\/span>/);
                  if (spanMatch) {
                    // linkText = spanMatch[1]; // 未使用のため削除
                  }
                }
                
                // title属性からワークスペース名を正確に抽出（ユーザー提案の方法）
                const titleMatch = linkMatch[0].match(/title="([^"]*)"/);
                const hrefMatch = linkMatch[0].match(/href="([^"]*)"/);
                
                if (titleMatch && hrefMatch) {
                  const titleContent = titleMatch[1];
                  console.log('🔍 Title content:', titleContent);
                  
                  // title属性から "Terraform Cloud/ORG/" プレフィックスを削除してワークスペース名を取得
                  const workspaceMatch = titleContent.match(/Terraform Cloud\/[^/]+\/(.+?)\s+Terraform plan:/);
                  if (workspaceMatch) {
                    const cleanWorkspace = workspaceMatch[1].trim();
                    workspaceLink = `<a href="${hrefMatch[1]}" target="_blank">${cleanWorkspace}</a>`;
                    console.log('🔗 Extracted workspace from title:', cleanWorkspace);
                    console.log('🔗 Constructed workspace link:', workspaceLink);
                  } else {
                    // フォールバック: textContentから取得
                    const workspaceFromText = text.substring(0, text.indexOf('Terraform plan:')).trim();
                    const cleanWorkspace = workspaceFromText.replace(/[—\-]\s*.*$/, '').trim();
                    workspaceLink = `<a href="${hrefMatch[1]}" target="_blank">${cleanWorkspace}</a>`;
                    console.log('🔗 Fallback to text content:', cleanWorkspace);
                  }
                }
              }
              
              // 2行表示のHTMLを構築
              const finalHTML = `
                <span class="terraform-plan-line">${workspaceLink}</span>
                <span class="terraform-plan-line">Terraform plan: ${coloredAdd}, ${coloredChange}, ${coloredDestroy}</span>
              `;
              
              console.log('🔧 Final HTML:', finalHTML);
              el.innerHTML = `<span class="terraform-plan-result">${finalHTML}</span>`;
              processed++;
              console.log('✅ Processed element with preserved links:', el);
            } else {
              // リンクがない場合は従来の方法
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
              console.log('✅ Processed element without links:', el);
            }
          } else {
            // Terraform planパターンにマッチしない場合のみプレフィックス削除のみ実行
            if (text !== el.textContent) {
              el.textContent = text;
              processed++;
              console.log('✅ Processed element (prefix only):', el);
            }
          }
          
          // 処理済みマークを付ける
          el.dataset.terraformFormatted = 'true';
        }
      });
    });
    
    console.log(`🎯 Processed ${processed} Terraform elements`);
  }

  function handlePageLoadOrTransition() {
    formatTerraformResults();
  }

  // 参考拡張機能と同じイベント処理を採用
  document.addEventListener("turbo:load", handlePageLoadOrTransition);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", handlePageLoadOrTransition);
  } else {
    handlePageLoadOrTransition();
  }

  // URL変化とSPA対応
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

  // ボタンクリック時の対応
  document.body.addEventListener("click", function (event) {
    const potentialButton = event.target.closest(
      'button, summary, [role="button"]'
    );

    if (potentialButton) {
      setTimeout(formatTerraformResults, 300);
    }
  });
})();