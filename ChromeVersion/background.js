// =============================================
//   BACKGROUND SERVICE WORKER
//   Tracks tab closures for the history panel
// =============================================

const MAX_CLOSED_TABS = 50;

// In-memory cache of open tabs: { [tabId]: { title, url, favIconUrl } }
// NOTE: service workers can be killed and restarted by Chrome at any time.
// We also mirror tab data to chrome.storage.session so closures are captured
// even after a service worker restart.
const tabCache = {};

function cacheTab(tab) {
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
    tabCache[tab.id] = { title: tab.title, url: tab.url, favIconUrl: tab.favIconUrl || '' };
}

// Populate cache for all existing tabs on startup
chrome.tabs.query({}, function(tabs) {
    tabs.forEach(cacheTab);
});

// Keep cache up to date as tabs navigate or load
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    cacheTab(tab);
});

// When a tab closes, save it to storage
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    if (removeInfo.isWindowClosing) return;

    const tab = tabCache[tabId];
    delete tabCache[tabId];

    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

    const entry = {
        title: tab.title || tab.url,
        url: tab.url,
        closedAt: Date.now()
    };

    chrome.storage.local.get(['closedTabs'], function(result) {
        const closedTabs = result.closedTabs || [];
        closedTabs.unshift(entry);
        if (closedTabs.length > MAX_CLOSED_TABS) closedTabs.length = MAX_CLOSED_TABS;
        chrome.storage.local.set({ closedTabs });
    });
});
