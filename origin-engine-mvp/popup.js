const API_ENDPOINT = 'https://my-app.vercel.app/api/check_domain';

const ui = {
  urlText: document.getElementById('url'),
  domainText: document.getElementById('domain'),
  domainAgeText: document.getElementById('domain-age'),
  riskBadge: document.getElementById('risk-score'),
  riskLabel: document.getElementById('risk-label'),
  spinner: document.getElementById('spinner'),
  statusText: document.getElementById('status'),
  checkArchives: document.getElementById('check-archives'),
};

let currentUrl = '';

const getActiveTabUrl = () =>
  new Promise((resolve, reject) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const tab = tabs && tabs[0];
        resolve(tab?.url || '');
      });
    } catch (error) {
      reject(error);
    }
  });

const setSpinnerVisible = (isVisible) => {
  if (!ui.spinner) return;
  ui.spinner.style.display = isVisible ? 'flex' : 'none';
};

const setStatus = (text) => {
  if (ui.statusText) {
    ui.statusText.textContent = text;
  }
};

const setRisk = (months) => {
  if (!ui.riskBadge || !ui.riskLabel) return;

  const isValid = Number.isFinite(months);
  const monthsValue = isValid ? months : null;

  const risk = (() => {
    if (monthsValue === null) return { label: 'Unknown', color: '#888' };
    if (monthsValue < 6) return { label: 'HIGH RISK', color: '#e64b3c' };
    if (monthsValue < 12) return { label: 'CAUTION', color: '#f3c623' };
    return { label: 'LOW RISK', color: '#3cb878' };
  })();

  ui.riskBadge.textContent = risk.label;
  ui.riskBadge.style.backgroundColor = risk.color;
  ui.riskLabel.textContent = isValid ? `${monthsValue.toFixed(0)} months old` : 'No age data';
};

const updateArchiveButton = () => {
  if (!ui.checkArchives) return;

  ui.checkArchives.addEventListener('click', () => {
    if (!currentUrl) return;
    const archiveUrl = `https://archive.today/newest/${encodeURIComponent(currentUrl)}`;
    chrome.tabs.create({ url: archiveUrl });
  });
};

const populateData = (data) => {
  if (ui.urlText) ui.urlText.textContent = currentUrl;
  if (ui.domainText && data?.domain) ui.domainText.textContent = data.domain;
  if (ui.domainAgeText && Number.isFinite(data?.domainAgeMonths)) {
    ui.domainAgeText.textContent = `${data.domainAgeMonths.toFixed(1)} months`;
  } else if (ui.domainAgeText) {
    ui.domainAgeText.textContent = 'Unknown';
  }

  setRisk(data?.domainAgeMonths);
};

const fetchDomainData = async () => {
  setSpinnerVisible(true);
  setStatus('Checking domain...');

  try {
    currentUrl = await getActiveTabUrl();
    if (ui.urlText) ui.urlText.textContent = currentUrl || 'Unknown URL';

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentUrl }),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data = await response.json();
    populateData(data);
    setStatus('Check complete');
  } catch (error) {
    console.error('Error checking domain:', error);
    setStatus('Unable to check domain');
    setRisk(null);
  } finally {
    setSpinnerVisible(false);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  updateArchiveButton();
  fetchDomainData();
});
