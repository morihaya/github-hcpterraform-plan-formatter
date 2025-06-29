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
          text = text.replace(/Terraform Cloud\/[^/]+\//, '');
          
          // 2. Terraform planの数値を簡潔にフォーマット
          const planMatch = text.match(/Terraform plan:\s*(\d+)\s*to add,\s*(\d+)\s*to change,\s*(\d+)\s*to destroy/);
          
          if (planMatch) {
            const [, add, change, destroy] = planMatch;
            const simplifiedText = `Terraform plan: ${add} to add, ${change} to change, ${destroy} to destroy`;
            
            text = text.replace(
              /Terraform plan:\s*\d+\s*to add,\s*\d+\s*to change,\s*\d+\s*to destroy\.?/,
              simplifiedText
            );
          }
          
          // テキストが変更された場合のみ適用
          if (text !== el.textContent) {
            el.textContent = text;
            processed++;
            console.log('✅ Processed element:', el);
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