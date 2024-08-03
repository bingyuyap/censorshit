let filterCriteria = [];

function initializeExtension() {
  chrome.runtime.sendMessage({ action: "getFilterCriteria" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && Array.isArray(response)) {
      filterCriteria = response;
      observeTweets();
    }
  });
}

function observeTweets() {
  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tweets = node.querySelectorAll('article[data-testid="tweet"]');
          tweets.forEach(analyzeTweet);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function analyzeTweet(tweetElement) {
  const tweetText =
    tweetElement.querySelector('div[data-testid="tweetText"]')?.textContent ||
    "";

  filterCriteria.forEach((criteria) => {
    chrome.runtime.sendMessage(
      { action: "analyzeTweet", tweetText, filterCriteria: criteria },
      (response) => {
        if (chrome.runtime.lastError) return;
        if (response.error) return;
        if (response.shouldFilter) {
          hideTweet(tweetElement);
          console.log(
            "Post removed:",
            tweetText,
            "Matched criteria:",
            criteria
          );
        }
      }
    );
  });
}

function hideTweet(tweetElement) {
  tweetElement.remove();
}

initializeExtension();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "filtersUpdated") {
    initializeExtension();
  }
  return true;
});
