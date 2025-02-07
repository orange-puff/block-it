document.addEventListener('DOMContentLoaded', function () {
  const urlInput = document.getElementById('urlInput');
  const addButton = document.getElementById('addButton');
  const output = document.getElementById('output');
  const blockedSitesDiv = document.getElementById('blockedSites');

  // Load blocked sites when popup opens
  loadBlockedSites();

  addButton.addEventListener('click', async function () {
    const url = urlInput.value.trim();
    if (url) {
      await addBlockedSite(url);
      urlInput.value = ''; // Clear the input
      showMessageWithUndo(`Added: ${url}`, 'success', async () => {
        await removeBlockedSite(url, false); // false means don't show removal message
      });
      loadBlockedSites();
    } else {
      showErrorMessage('Please enter a valid URL');
    }
  });

  // Handle Enter key
  urlInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      addButton.click();
    }
  });

  async function addBlockedSite(url, showMessage = true) {
    const { blockedSites = [] } = await browser.storage.local.get('blockedSites');
    if (!blockedSites.includes(url)) {
      blockedSites.push(url);
      await browser.storage.local.set({ blockedSites });

      if (showMessage) {
        showMessageWithUndo(`Added: ${url}`, 'success', async () => {
          await removeBlockedSite(url, false);
        });
      }
    }
  }

  async function removeBlockedSite(url, showMessage = true) {
    const { blockedSites = [] } = await browser.storage.local.get('blockedSites');
    const updatedSites = blockedSites.filter(site => site !== url);
    await browser.storage.local.set({ blockedSites: updatedSites });
    loadBlockedSites();

    if (showMessage) {
      showMessageWithUndo(`Removed: ${url}`, 'success', async () => {
        await addBlockedSite(url, false); // false means don't show add message
      });
    }
  }

  async function loadBlockedSites() {
    const { blockedSites = [] } = await browser.storage.local.get('blockedSites');
    blockedSitesDiv.innerHTML = ''; // Clear current list

    if (blockedSites.length === 0) {
      blockedSitesDiv.innerHTML = '<div class="empty-message">No sites blocked yet</div>';
      return;
    }

    blockedSites.forEach(site => {
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';
      siteItem.innerHTML = `
        <span class="site-url">${site}</span>
        <button class="remove-btn">Remove</button>
      `;

      siteItem.querySelector('.remove-btn').addEventListener('click', () => {
        removeBlockedSite(site);
      });

      blockedSitesDiv.appendChild(siteItem);
    });
  }

  function showMessageWithUndo(message, type, undoCallback) {
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