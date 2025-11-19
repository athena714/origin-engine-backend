// TODO: WE WILL UPDATE THIS URL IN STEP 2
const API_ENDPOINT = 'https://vercel-origin-engine.vercel.app/api/check_domain';

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
  if (ui.statusText) ui.statusText.textContent = text;
};

const setRisk = (data) => {
  if (!ui.riskBadge || !ui.riskLabel) return;

  // --- SAFEGUARD START ---
  // If data is missing (because of a server error), handle it gracefully
  if (!data) {
    ui.riskBadge.textContent = 'ERROR';
    ui.riskBadge.style.backgroundColor = '#888';
    ui.riskLabel.textContent = 'Connection Failed';
    if (ui.domainAgeText) ui.domainAgeText.textContent = 'Check internet/server';
    return; 
  }
  // --- SAFEGUARD END ---

  let label = 'UNKNOWN';
  let color = '#888';
  let summary = 'Analysis failed';

  const level = data.risk_level ? data.risk_level.toUpperCase() : 'UNKNOWN';
  
  if (level === 'HIGH' || level === 'CRITICAL') {
      label = 'HIGH RISK';
      color = '#e64b3c'; 
  } else if (level === 'MEDIUM') {
      label = 'CAUTION';
      color = '#f3c623'; 
  } else if (level === 'LOW') {
      label = 'SAFE';
      color = '#3cb878'; 
  }

  ui.riskBadge.textContent = label;
  ui.riskBadge.style.backgroundColor = color;
  ui.riskLabel.textContent = data.summary || "No summary provided";
  
  // FIXED: The comment is now separate from the code
  if (ui.domainAgeText) {
      const flags = data.red_flags && Array.isArray(data.red_flags) 
          ? data.red_flags.join(", ") 
          : "No flags detected";
      ui.domainAgeText.textContent = flags;
  }
};

const populateData = (data) => {
  if (ui.urlText) ui.urlText.textContent = currentUrl;
  try {
      const hostname = new URL(currentUrl).hostname;
      if (ui.domainText) ui.domainText.textContent = hostname;
  } catch (e) {
      if (ui.domainText) ui.domainText.textContent = "Unknown Domain";
  }
  setRisk(data);
};

const fetchDomainData = async () => {
  setSpinnerVisible(true);
  setStatus('AI Agent is analyzing...');

  try {
    currentUrl = await getActiveTabUrl();
    if (ui.urlText) ui.urlText.textContent = currentUrl || 'Unknown URL';

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentUrl }),
    });

    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    populateData(data);
    setStatus('Analysis Complete');
  } catch (error) {
    console.error('Error:', error);
    setStatus('Error: ' + error.message);
    setRisk(null); // Pass null so the safeguard runs
  } finally {
    setSpinnerVisible(false);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  if (ui.checkArchives) {
      ui.checkArchives.addEventListener('click', () => {
        if (!currentUrl) return;
        const archiveUrl = `https://archive.today/newest/${encodeURIComponent(currentUrl)}`;
        chrome.tabs.create({ url: archiveUrl });
      });
  }
  fetchDomainData();
});
const setStatus = (text) => {
  if (ui.statusText) {
    ui.statusText.textContent = text;
  }
};

// CHANGE 2: New Logic to handle the AI's response
const setRisk = (data) => {
  if (!ui.riskBadge || !ui.riskLabel) return;

  // Default values
  let label = 'UNKNOWN';
  let color = '#888'; // Gray
  let summary = 'Analysis failed';

  if (data) {
    // Use the AI's "risk_level" directly
    const level = data.risk_level ? data.risk_level.toUpperCase() : 'UNKNOWN';
    
    if (level === 'HIGH' || level === 'CRITICAL') {
        label = 'HIGH RISK';
        color = '#e64b3c'; // Red
    } else if (level === 'MEDIUM') {
        label = 'CAUTION';
        color = '#f3c623'; // Yellow
    } else if (level === 'LOW') {
        label = 'SAFE';
        color = '#3cb878'; // Green
    }

    // Use the AI's written summary
    summary = data.summary || "No summary provided";
  }

  // Update the Badge (The Colored Box)
  ui.riskBadge.textContent = label;
  ui.riskBadge.style.backgroundColor = color;
  
  // Update the text next to it (The AI's Explanation)
  ui.riskLabel.textContent = summary;
  
  // If the UI has a separate text for age/red flags, update that too
  if (ui.domainAgeText && data.red_flags) {
      // Join the red flags into a clean list
      ui.domainAgeText.textContent = data.red_flags.join(", ") || "No flags detected";
  }
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
  
  // Try to extract domain name from URL for display
  try {
      const hostname = new URL(currentUrl).hostname;
      if (ui.domainText) ui.domainText.textContent = hostname;
  } catch (e) {
      if (ui.domainText) ui.domainText.textContent = "Unknown Domain";
  }

  // Pass the full AI data to the risk function
  setRisk(data);
};

const fetchDomainData = async () => {
  setSpinnerVisible(true);
  setStatus('AI Agent is analyzing...');

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
    
    // Check if the backend sent an error (like missing params)
    if (data.error) {
        throw new Error(data.error);
    }

    populateData(data);
    setStatus('Analysis Complete');
  } catch (error) {
    console.error('Error checking domain:', error);
    setStatus('Error: ' + error.message);
    setRisk(null);
  } finally {
    setSpinnerVisible(false);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  updateArchiveButton();
  fetchDomainData();
});
