let referenceImageHashes = [];

function getFilterCriteria() {
  return new Promise((resolve) => {
    chrome.storage.sync.get("filterCriteria", (result) => {
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
  chrome.storage.sync.set({ removedPostsCount: {} });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getFilterCriteria") {
    getFilterCriteria().then(sendResponse);
    return true;
  } else if (request.action === "updateFilterCriteria") {
    saveFilterCriteria(request.filterCriteria).then(() => {
      sendResponse({ success: true });
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { action: "filtersUpdated" });
        });
      });
    });
    return true;
  } else if (request.action === "analyzeTweet") {
    getFilterCriteria().then((criteria) => {
      analyzeTweetWithOllama(request.tweetText, criteria)
        .then(sendResponse)
        .catch((error) => sendResponse({ error: error.message }));
    });
    return true;
  } else if (request.action === "postRemoved") {
    const userId = request.userId;

    chrome.storage.sync.get(
      ["removedPostsCount", "muteThreshold"],
      (result) => {
        if (chrome.runtime.lastError) {
          console.error("Error fetching data:", chrome.runtime.lastError);
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
          return;
        }

        let counts = result.removedPostsCount || {};
        const muteThreshold = result.muteThreshold || 3; // Default to 3 if not set

        counts[userId] = (counts[userId] || 0) + 1;

        chrome.storage.sync.set({ removedPostsCount: counts }, () => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error saving removedPostsCount:",
              chrome.runtime.lastError
            );
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }

          if (counts[userId] == muteThreshold) {
            chrome.tabs.sendMessage(sender.tab.id, {
              action: "muteUser",
              userId: userId,
            });
          }

          sendResponse({ success: true });
        });
      }
    );
    return true; // Indicates asynchronous response
  } else if (request.action === "setReferenceHashes") {
    referenceImageHashes = request.hashes;
    chrome.storage.sync.set({ referenceHashes: referenceImageHashes }, () => {
      sendResponse({ status: "Hashes updated and saved" });
    });
    return true; // Indicates an asynchronous response
  } else if (request.action === "getReferenceHashes") {
    sendResponse({ hashes: referenceImageHashes });
    return true;
  }
});

// Keyboard shortcut listeners
chrome.commands.onCommand.addListener((command) => {
  if (command === "remove_post") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "removeCurrentPost" });
    });
  } else if (command === "toggle_mute") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "toggleMuteCurrentUser" });
    });
  }
});

async function analyzeTweetWithOllama(tweetText, filterCriteria) {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1",
        prompt: `Given the following tweet: "${tweetText}", and the filter criteria: "${filterCriteria}", respond with only "yes" if the tweet fulfills the criteria or "no" if it should be kept. Only reply yes or no`,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.response.trim().toLowerCase();
    return { shouldFilter: answer === "yes" };
  } catch (error) {
    throw error;
  }
}
