// Helper function to check if a URL matches any blocked site
function isBlockedSite(url, blockedSites) {
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

// Get the period start time (start of hour or day)
function getPeriodStart(perUnit) {
  const now = new Date();
  if (perUnit === 'hour') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  } else { // day
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}

// Track site usage
async function trackUsage(hostname) {
  const periodKey = `usage_${hostname}`;
  const { [periodKey]: usage = {} } = await browser.storage.local.get(periodKey);
  const now = new Date();

  if (!usage.startTime || !usage.periodStart ||
    new Date(usage.periodStart) < getPeriodStart(usage.perUnit)) {
    // Start new tracking period
    usage.totalTime = 0;
    usage.periodStart = now.toISOString();
  }

  if (usage.startTime) {
    usage.totalTime += now - new Date(usage.startTime);
  }
  usage.startTime = now.toISOString();
  console.log(usage);

  await browser.storage.local.set({ [periodKey]: usage });
  return usage.totalTime;
}

// Check if site should be blocked based on time limit
async function shouldBlock(site, hostname) {
  const periodKey = `usage_${hostname}`;
  const { [periodKey]: usage = {} } = await browser.storage.local.get(periodKey);

  // Initialize usage tracking if needed
  if (!usage.perUnit) {
    usage.perUnit = site.timeLimit.perUnit;
    usage.periodStart = getPeriodStart(site.timeLimit.perUnit).toISOString();
    usage.totalTime = 0;
    await browser.storage.local.set({ [periodKey]: usage });
  }

  const totalTime = await trackUsage(hostname);
  const allowedTime = getTimeInMs(site.timeLimit);

  return totalTime > allowedTime;
}

// Reset usage when period ends
browser.alarms.create('resetUsage', { periodInMinutes: 1 });
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'resetUsage') {
    const { blockedSites = [] } = await browser.storage.local.get('blockedSites');
    for (const site of blockedSites) {
      const hostname = new URL('http://' + site.url).hostname;
      const periodKey = `usage_${hostname}`;
      const { [periodKey]: usage = {} } = await browser.storage.local.get(periodKey);

      if (usage.periodStart &&
        new Date(usage.periodStart) < getPeriodStart(site.timeLimit.perUnit)) {
        // Reset for new period
        usage.totalTime = 0;
        usage.periodStart = new Date().toISOString();
        usage.startTime = null;
        await browser.storage.local.set({ [periodKey]: usage });
      }
    }
  }
});

// Listen for web requests
browser.webRequest.onBeforeRequest.addListener(
  async function (details) {
    const { blockedSites = [] } = await browser.storage.local.get('blockedSites');
    const matchedSite = isBlockedSite(details.url, blockedSites);

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