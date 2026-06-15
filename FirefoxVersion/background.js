// =============================================
//   BACKGROUND SERVICE WORKER
//   Tracks tab closures for the history panel
// =============================================

const MAX_CLOSED_TABS = 50;

// ── Firefox launch-tab fix ────────────────────────────────────────────────────
// Firefox does not apply chrome_url_overrides.newtab to the very first tab that
// opens on browser startup — it shows the built-in new-tab page instead.
// We detect that tab during onStartup and redirect it to our page.
const NEW_TAB_PAGE = chrome.runtime.getURL('index.html');

// URLs Firefox shows for its own new-tab / home page on launch.
const FIREFOX_NEWTAB_URLS = ['about:newtab', 'about:home', 'about:blank'];

function isFirefoxNewTab(url) {
    if (!url) return false;
    return FIREFOX_NEWTAB_URLS.some(u => url === u || url.startsWith(u));
}

function scanAndFixNewTabs() {
    chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
            if (isFirefoxNewTab(tab.url)) {
                chrome.tabs.update(tab.id, { url: NEW_TAB_PAGE });
            }
        });
    });
}

chrome.runtime.onStartup.addListener(function () {
    // Try immediately, then retry as Firefox finishes restoring/opening startup tabs.
    scanAndFixNewTabs();
    setTimeout(scanAndFixNewTabs, 100);
    setTimeout(scanAndFixNewTabs, 300);
    setTimeout(scanAndFixNewTabs, 600);
});

// Catch startup tabs that are created or that navigate to about:newtab slightly late.
chrome.tabs.onCreated.addListener(function (tab) {
    if (isFirefoxNewTab(tab.url)) {
        chrome.tabs.update(tab.id, { url: NEW_TAB_PAGE });
    }
});
// ─────────────────────────────────────────────────────────────────────────────

// In-memory cache of open tabs: { [tabId]: { title, url, favIconUrl } }
const tabCache = {};

function cacheTab(tab) {
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) return;
    tabCache[tab.id] = { title: tab.title, url: tab.url, favIconUrl: tab.favIconUrl || '' };
}

// Populate cache for all existing tabs on startup
chrome.tabs.query({}, function(tabs) {
    tabs.forEach(cacheTab);
});

// Keep cache up to date as tabs navigate or load
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (isFirefoxNewTab(changeInfo.url)) {
        chrome.tabs.update(tabId, { url: NEW_TAB_PAGE });
    }
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
