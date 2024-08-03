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
  const userId = getUserIdFromTweet(tweetElement);

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
          chrome.runtime.sendMessage({ action: "postRemoved", userId: userId });
        }
      }
    );
  });
}

function hideTweet(tweetElement) {
  tweetElement.remove();
}

function getUserIdFromTweet(tweetElement) {
  // Try to find the user ID from the article's data attribute
  const articleUserId = tweetElement
    .closest("article")
    ?.dataset.testid?.split("-")?.[1];
  if (articleUserId) return articleUserId;

  // If not found, try to extract from the user's profile link
  const userLink = tweetElement.querySelector('a[role="link"][href^="/"]');
  if (userLink) {
    const href = userLink.getAttribute("href");
    const match = href.match(/^\/([^/]+)/);
    if (match) return match[1]; // Return the username as a fallback
  }

  // If still not found, try to find it in a data attribute of a child element
  const dataUserId = tweetElement
    .querySelector('[data-testid^="UserAvatar-Container-"]')
    ?.dataset.testid?.split("-")
    .pop();
  if (dataUserId) return dataUserId;

  console.error("Could not find user ID for tweet:", tweetElement);
  return null;
}

function removeCurrentPost() {
  const tweetElement = document.querySelector('article[data-testid="tweet"]');
  if (tweetElement) {
    const userId = getUserIdFromTweet(tweetElement);
    hideTweet(tweetElement);

    chrome.runtime.sendMessage({ action: "postRemoved", userId: userId });
  }
}
function muteUser() {
  // Find the tweet
  const tweet = document.querySelector('article[data-testid="tweet"]');
  if (!tweet) {
    console.log("No tweet found on the page");
    return;
  }

  // Find the More button using data-testid="caret"
  const moreButton = tweet.querySelector('button[data-testid="caret"]');
  if (!moreButton) {
    console.log("More button (caret) not found on the tweet");
    return;
  }

  // Click the More button
  moreButton.click();
  console.log("Clicked More button");

  // Wait for the dropdown menu to appear and then find the mute option
  setTimeout(() => {
    const muteOption = Array.from(
      document.querySelectorAll('div[role="menuitem"]')
    ).find((item) => item.textContent.toLowerCase().includes("mute"));

    if (muteOption) {
      muteOption.click();
      console.log("Clicked Mute option");
    } else {
      console.log("Mute option not found in the dropdown menu");
    }
  }, 500);
}

function findMoreButton(tweet) {
  // First, try to find by aria-label
  let moreButton = tweet.querySelector('div[aria-label="More"]');

  // If not found, look for the specific SVG structure
  if (!moreButton) {
    const svgPath = tweet.querySelector(
      'svg path[d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"]'
    );
    if (svgPath) {
      moreButton = svgPath.closest('div[role="button"]');
    }
  }

  return moreButton;
}

function toggleMuteCurrentUser() {
  const tweetElement = document.querySelector('article[data-testid="tweet"]');
  if (tweetElement) {
    const userId = getUserIdFromTweet(tweetElement);
    muteUser(userId);
  }
}

initializeExtension();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "filtersUpdated") {
    initializeExtension();
  } else if (request.action === "removeCurrentPost") {
    removeCurrentPost();
  } else if (request.action === "toggleMuteCurrentUser") {
    toggleMuteCurrentUser();
  } else if (request.action === "muteUser") {
    muteUser(request.userId);
  }
  return true;
});
