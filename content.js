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
          
          // 1. "Terraform Cloud/PROJECT/" プレフィックスを削除
          const originalText = text;
          text = text.replace(/Terraform Cloud\/[^/]+\//, '');
          
          // 2. Terraform planの数値を簡潔にフォーマット
          const planMatch = text.match(/Terraform plan:\s*(\d+)\s*to add,\s*(\d+)\s*to change,\s*(\d+)\s*to destroy/);
          
          if (planMatch) {
            const [, add, change, destroy] = planMatch;
            
            // 元のHTML構造を保持してWorkspace名のリンクを抽出
            const originalHTML = el.innerHTML;
            
            // Workspace名を抽出（Terraform planより前の部分）
            const workspacePart = text.substring(0, text.indexOf('Terraform plan:')).trim();
            const workspaceName = workspacePart.replace(/[—\-\s]+$/, '').trim(); // 末尾の記号を削除
            
            // リンク部分を保持（aタグがある場合）
            let workspaceHTML = workspaceName;
            if (originalHTML.includes('<a ') && workspaceName) {
              // 既存のリンクタグを探して保持
              const linkMatch = originalHTML.match(/<a[^>]*>([^<]*)<\/a>/);
              if (linkMatch && linkMatch[1].includes(workspaceName.split(' ')[0])) {
                workspaceHTML = linkMatch[0];
              }
            }
            
            // カラー表示用のHTML要素を作成（2行レイアウト）
            const createColoredCount = (count, type) => {
              const num = parseInt(count);
              const highlightClass = num > 0 ? ' highlight' : '';
              return `<span class="terraform-count ${type}${highlightClass}">${count}</span>`;
            };
            
            const coloredAdd = createColoredCount(add, 'add');
            const coloredChange = createColoredCount(change, 'change');
            const coloredDestroy = createColoredCount(destroy, 'destroy');
            
            const coloredHTML = `<span class="terraform-plan-result">
              ${workspaceHTML ? `<span class="terraform-plan-line">${workspaceHTML}</span>` : ''}
              <span class="terraform-plan-line">Terraform plan: ${coloredAdd} to add, ${coloredChange} to change, ${coloredDestroy} to destroy</span>
            </span>`;
            
            // 要素の内容を完全に置き換え
            el.innerHTML = coloredHTML;
            processed++;
            console.log('✅ Processed element with colors:', el)
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