const WORKER_ENDPOINT = 'https://my-worker.workers.dev';

const ui = {
  switchButton: document.getElementById('switch-substack'),
  status: document.getElementById('status'),
};

let pulseIntervalId = null;

const setStatus = (message) => {
  if (ui.status) {
    ui.status.textContent = message;
  }
};

const startLoadingAnimation = () => {
  if (!ui.status || pulseIntervalId) return;
  let faded = false;
  pulseIntervalId = setInterval(() => {
    faded = !faded;
    ui.status.style.opacity = faded ? '0.6' : '1';
  }, 500);
};

const stopLoadingAnimation = () => {
  if (pulseIntervalId) {
    clearInterval(pulseIntervalId);
    pulseIntervalId = null;
  }
  if (ui.status) {
    ui.status.style.opacity = '1';
  }
};

const getActiveTab = () =>
  new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(tabs && tabs[0]);
    });
  });

const extractPageText = async (tabId) => {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.body?.innerText || '',
  });
  return (result?.result || '').trim();
};

const sendToWorker = async (text) => {
  const response = await fetch(WORKER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Worker error: ${response.status}`);
  }

  return response.json();
};

const handleSwitchToSubstack = async () => {
  setStatus('Searching...');
  startLoadingAnimation();

  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      throw new Error('No active tab found');
    }

    const pageText = await extractPageText(tab.id);
    if (!pageText) {
      throw new Error('Could not read text from this page');
    }

    const data = await sendToWorker(pageText);
    const destination = data?.url;

    if (destination) {
      setStatus('Switching you to Substack...');
      await chrome.tabs.update(tab.id, { url: destination });
    } else {
      setStatus("We couldn't find a Substack version for this page.");
    }
  } catch (error) {
    console.error('Switch to Substack error:', error);
    setStatus('Something went wrong. Please try again.');
  } finally {
    stopLoadingAnimation();
  }
};

window.addEventListener('DOMContentLoaded', () => {
  if (ui.switchButton) {
    ui.switchButton.addEventListener('click', handleSwitchToSubstack);
  }
});
