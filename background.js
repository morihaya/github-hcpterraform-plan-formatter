// Background script for GitHub HCP Terraform Plan Formatter
// Handles badge display when extension processes Terraform plans

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateBadge') {
    const tabId = sender.tab.id;
    const count = message.count;

    if (count > 0) {
      // Show badge with count
      chrome.action.setBadgeText({
        text: count.toString(),
        tabId: tabId
      });

      // Set badge background color (green for successful processing)
      chrome.action.setBadgeBackgroundColor({
        color: '#4CAF50',
        tabId: tabId
      });

      // Set badge title for tooltip
      chrome.action.setTitle({
        title: `GitHub HCP Terraform Plan Formatter - ${count} plan(s) formatted`,
        tabId: tabId
      });
    } else {
      // Clear badge if no plans processed
      chrome.action.setBadgeText({
        text: '',
        tabId: tabId
      });

      chrome.action.setTitle({
        title: 'GitHub HCP Terraform Plan Formatter',
        tabId: tabId
      });
    }
  }
});

// Clear badge when tab is updated (page navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url && tab.url.includes('github.com')) {
    chrome.action.setBadgeText({
      text: '',
      tabId: tabId
    });

    chrome.action.setTitle({
      title: 'GitHub HCP Terraform Plan Formatter',
      tabId: tabId
    });
  }
});

// Clear badge when tab becomes active
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url && !tab.url.includes('github.com')) {
      chrome.action.setBadgeText({
        text: '',
        tabId: activeInfo.tabId
      });
    }
  });
});
