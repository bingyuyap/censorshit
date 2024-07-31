const DEFAULT_FILTER_CRITERIA = "Filter tweets that are inappropriate or offensive";

function getFilterCriteria() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('filterCriteria', (result) => {
      resolve(result.filterCriteria || DEFAULT_FILTER_CRITERIA);
    });
  });
}

function saveFilterCriteria(criteria) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ filterCriteria: criteria }, resolve);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  getFilterCriteria();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getFilterCriteria") {
    getFilterCriteria().then(sendResponse);
    return true;
  } else if (request.action === "updateFilterCriteria") {
    saveFilterCriteria(request.filterCriteria).then(() => {
      sendResponse({ success: true });
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: "filtersUpdated" });
        });
      });
    });
    return true;
  } else if (request.action === "analyzeTweet") {
    getFilterCriteria().then(criteria => {
      analyzeTweetWithOllama(request.tweetText, criteria)
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }));
    });
    return true;
  }
});

async function analyzeTweetWithOllama(tweetText, filterCriteria) {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "llama3.1",
        prompt: `Given the following tweet: "${tweetText}", and the filter criteria: "${filterCriteria}", respond with only "yes" if the tweet fulfills the criteria or "no" if it should be kept. Only reply yes or no`,
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.response.trim().toLowerCase();
    return { shouldFilter: answer === 'yes' };
  } catch (error) {
    throw error;
  }
}
