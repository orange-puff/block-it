// Helper function to check if a URL matches any blocked site
function isBlockedSite(url, blockedSites) {
  const hostname = new URL(url).hostname;
  return blockedSites.some(blockedSite => {
    const cleanBlockedSite = blockedSite.replace(/^www\./, '');
    const cleanHostname = hostname.replace(/^www\./, '');
    return cleanHostname.includes(cleanBlockedSite);
  });
}

// Listen for web requests
browser.webRequest.onBeforeRequest.addListener(
  async function (details) {
    // Get blocked sites from storage
    const { blockedSites = [] } = await browser.storage.local.get('blockedSites');

    // Check if the URL is blocked
    if (isBlockedSite(details.url, blockedSites)) {
      return { redirectUrl: browser.runtime.getURL("blocked.html") };
    }

    return { cancel: false };
  },
  { urls: ["<all_urls>"] }, // Match pattern to listen on all URLs
  ["blocking"]              // Makes this a blocking listener that can modify or cancel requests
); 