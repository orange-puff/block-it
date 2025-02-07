document.addEventListener('DOMContentLoaded', function () {
  const urlInput = document.getElementById('urlInput');
  const addButton = document.getElementById('addButton');
  const output = document.getElementById('output');
  const blockedSitesDiv = document.getElementById('blockedSites');
  const timeValue = document.getElementById('timeValue');
  const timeUnit = document.getElementById('timeUnit');
  const perUnit = document.getElementById('perUnit');

  // Load blocked sites when popup opens
  loadBlockedSites();

  addButton.addEventListener('click', async function () {
    const url = urlInput.value.trim();
    const time = {
      value: parseInt(timeValue.value) || 0,
      timeUnit: timeUnit.value,
      perUnit: perUnit.value
    };

    if (url && time.value > 0) {
      await addBlockedSite(url, time);
      urlInput.value = '';
      timeValue.value = '';
      showMessageWithUndo(`Added: ${url}`, async () => {
        await removeBlockedSite(url, false);
      });
      loadBlockedSites();
    } else {
      showErrorMessage(url ? 'Please enter a valid time limit' : 'Please enter a valid URL');
    }
  });

  // Handle Enter key
  urlInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      addButton.click();
    }
  });

  async function addBlockedSite(url, time, showMessage = true) {
    const { blockedSites = [] } = await browser.storage.local.get('blockedSites');
    if (!blockedSites.some(site => site.url === url)) {
      blockedSites.push({
        url,
        timeLimit: time,
        createdAt: new Date().toISOString()
      });
      await browser.storage.local.set({ blockedSites });

      if (showMessage) {
        showMessageWithUndo(`Added: ${url}`, async () => {
          await removeBlockedSite(url, false);
        });
      }
    }
  }

  async function removeBlockedSite(url, showMessage = true) {
    const { blockedSites = [] } = await browser.storage.local.get('blockedSites');
    const updatedSites = blockedSites.filter(site => site.url !== url);
    await browser.storage.local.set({ blockedSites: updatedSites });
    loadBlockedSites();

    if (showMessage) {
      showMessageWithUndo(`Removed: ${url}`, async () => {
        const site = blockedSites.find(s => s.url === url);
        await addBlockedSite(url, site.timeLimit, false);
      });
    }
  }

  async function loadBlockedSites() {
    const { blockedSites = [] } = await browser.storage.local.get('blockedSites');
    blockedSitesDiv.innerHTML = '';

    if (blockedSites.length === 0) {
      blockedSitesDiv.innerHTML = '<div class="empty-message">No sites blocked yet</div>';
      return;
    }

    blockedSites.forEach(site => {
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';
      siteItem.innerHTML = `
        <div class="site-info">
          <span class="site-url">${site.url}</span>
          <span class="site-limit">${formatTimeLimit(site.timeLimit)}</span>
        </div>
        <button class="remove-btn">Remove</button>
      `;

      siteItem.querySelector('.remove-btn').addEventListener('click', () => {
        removeBlockedSite(site.url);
      });

      blockedSitesDiv.appendChild(siteItem);
    });
  }

  function formatTimeLimit(timeLimit) {
    return `${timeLimit.value} ${timeLimit.timeUnit}(s) per ${timeLimit.perUnit}`;
  }

  function showMessageWithUndo(message, undoCallback) {
    output.innerHTML = `
      <div class="message-container">
        <span>${message}</span>
        <button class="undo-btn">Undo</button>
      </div>
    `;

    if (message.startsWith('Added')) {
      output.style.borderLeftColor = '#059669'; // green
      output.style.backgroundColor = '#ecfdf5'; // light green
    } else if (message.startsWith('Removed')) {
      output.style.borderLeftColor = '#dc2626'; // red
      output.style.backgroundColor = '#fee2e2'; // light red
    } else {
      output.style.borderLeftColor = '#dc2626';
      output.style.backgroundColor = '#fef2f2';
    }

    const undoButton = output.querySelector('.undo-btn');
    undoButton.addEventListener('click', async () => {
      await undoCallback();
      loadBlockedSites();
      // Reset all styles and content
      output.textContent = '';
      output.style.backgroundColor = '';
      output.style.borderLeftColor = '';
    });
  }

  function showErrorMessage(message) {
    output.textContent = message;
    output.style.borderLeftColor = '#dc2626';
    output.style.backgroundColor = '#fef2f2';
  }
}); 