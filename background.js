// Helper function to check if a URL matches any blocked site
function isSiteInBlockedList(url, blockedSites) {
  const hostname = new URL(url).hostname;
  return blockedSites.find(site => {
    const cleanBlockedSite = site.url.replace(/^www\./, '');
    const cleanHostname = hostname.replace(/^www\./, '');
    return cleanHostname.includes(cleanBlockedSite);
  });
}

// Convert time to milliseconds
function getTimeInMs(timeLimit) {
  const multipliers = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000
  };
  return timeLimit.value * multipliers[timeLimit.timeUnit];
}

// Get refresh time based on perUnit
function getRefreshTime(startTime, perUnit) {
  const date = new Date(startTime);
  if (perUnit === 'hour') {
    date.setHours(date.getHours() + 1);
  } else if (perUnit === 'day') {
    date.setDate(date.getDate() + 1);
  }
  return date.getTime();
}

// Track site usage
async function trackUsage(hostname, perUnit) {
  const periodKey = `usage_${hostname}`;
  const { [periodKey]: usage = {} } = await browser.storage.local.get(periodKey);
  const now = Date.now();

  // If no usage data exists or we've passed the refresh time, reset the tracking
  if (!usage.startTime || !usage.refreshTime || now > usage.refreshTime) {
    usage.startTime = now;
    usage.refreshTime = getRefreshTime(now, perUnit);
    usage.totalTime = 0;
  } else if (usage.startTime) {
    usage.totalTime = now - usage.startTime;
  }

  await browser.storage.local.set({ [periodKey]: usage });
  return usage.totalTime;
}

// Check if site should be blocked based on time limit
async function shouldBlock(site, hostname) {
  const totalTime = await trackUsage(hostname, site.timeLimit.perUnit);
  const allowedTime = getTimeInMs(site.timeLimit);
  return totalTime > allowedTime;
}

// Every 1 minute, check if it is time to refresh
browser.alarms.create('resetUsage', { periodInMinutes: 1 });
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'resetUsage') {
    const { blockedSites = [] } = await browser.storage.local.get('blockedSites');
    for (const site of blockedSites) {
      const hostname = new URL('http://' + site.url).hostname;
      const periodKey = `usage_${hostname}`;
      const { [periodKey]: usage = {} } = await browser.storage.local.get(periodKey);

      if (usage.refreshTime && Date.now() > usage.refreshTime) {
        // Reset for new period
        usage.startTime = Date.now();
        usage.refreshTime = getRefreshTime(usage.startTime, site.timeLimit.perUnit);
        usage.totalTime = 0;
        await browser.storage.local.set({ [periodKey]: usage });
      }
    }
  }
});

// Listen for web requests
browser.webRequest.onBeforeRequest.addListener(
  async function (details) {
    const { blockedSites = [] } = await browser.storage.local.get('blockedSites');
    const matchedSite = isSiteInBlockedList(details.url, blockedSites);

    if (matchedSite) {
      const hostname = new URL(details.url).hostname;
      if (await shouldBlock(matchedSite, hostname)) {
        return { redirectUrl: browser.runtime.getURL("blocked.html") };
      }
    }

    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);