// GitHub HCP Terraform Plan Formatter - background service worker
// Shows a per-tab badge with the number of formatted Terraform plans.

const DEFAULT_TITLE = "GitHub HCP Terraform Plan Formatter";
const BADGE_COLOR = "#4CAF50";

function updateBadge(tabId, count) {
  const updates =
    count > 0
      ? [
          chrome.action.setBadgeText({ tabId, text: String(count) }),
          chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR }),
          chrome.action.setTitle({
            tabId,
            title: `${DEFAULT_TITLE} - ${count} plan(s) formatted`,
          }),
        ]
      : [
          chrome.action.setBadgeText({ tabId, text: "" }),
          chrome.action.setTitle({ tabId, title: DEFAULT_TITLE }),
        ];

  // The tab may have been closed in the meantime; ignore those failures.
  return Promise.allSettled(updates);
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "updateBadge" && sender.tab?.id != null) {
    updateBadge(sender.tab.id, Number(message.count) || 0);
  }
});

// Reset the badge whenever the tab starts loading a new page; the content
// script reports a fresh count once it has formatted anything.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    updateBadge(tabId, 0);
  }
});
