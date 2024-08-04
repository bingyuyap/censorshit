let filterCriteria = [];
let referenceHashes = [];
const similarityThreshold = 20;
const INITIAL_DELAY = 2000;
const MUTATION_DELAY = 500;

function initializeExtension() {
  // First, set up tweet observation
  observeTweets();

  // Then, get filter criteria
  chrome.runtime.sendMessage({ action: "getFilterCriteria" }, (response) => {
    if (response && Array.isArray(response)) {
      filterCriteria = response;
    } else {
      filterCriteria = [];
    }
  });

  // Get reference hashes
  chrome.storage.local.get("imageHashPairs", (result) => {
    if (chrome.runtime.lastError) {
      console.error(
        "Error getting image hash pairs:",
        chrome.runtime.lastError
      );
      return;
    }

    if (result.imageHashPairs && Array.isArray(result.imageHashPairs)) {
      referenceHashes = result.imageHashPairs.map((pair) => pair.hash);
    } else {
      referenceHashes = [];
    }

    initializeImageSimilarityCheck();
  });
}

function initializeImageSimilarityCheck() {
  if (referenceHashes.length > 0) {
    const tweets = document.querySelectorAll('article[data-testid="tweet"]');
    tweets.forEach((tweet) =>
      checkTweetForSimilarImages(tweet, referenceHashes)
    );
  } else {
  }
}

function observeTweets() {
  // Initial check with a delay
  setTimeout(() => {
    const existingTweets = document.querySelectorAll(
      'article[data-testid="tweet"]'
    );
    existingTweets.forEach(analyzeTweet);
  }, INITIAL_DELAY);

  // Set up the observer for future changes
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    for (let mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldCheck = true;
        break;
      }
    }

    if (shouldCheck) {
      setTimeout(() => {
        try {
          const tweets = document.querySelectorAll(
            'article[data-testid="tweet"]'
          );
          tweets.forEach(analyzeTweet);
        } catch (error) {
          console.error("Error checking for new tweets:", error);
        }
      }, MUTATION_DELAY);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function analyzeTweet(tweetElement) {
  if (tweetElement.dataset.analyzed) return;
  tweetElement.dataset.analyzed = "true";

  const tweetText =
    tweetElement.querySelector('div[data-testid="tweetText"]')?.textContent ||
    "";
  const userId = getUserIdFromTweet(tweetElement);

  checkImageSimilarity(tweetElement, userId);
  checkTextFilters(tweetText, userId, tweetElement);
}

function checkImageSimilarity(tweetElement, userId) {
  if (referenceHashes.length > 0) {
    tweetElement
      .querySelectorAll('div[data-testid="tweetPhoto"] img')
      .forEach((img) => {
        if (img.src) {
          processImage(getHighQualityImageUrl(img.src), (hash) => {
            if (
              referenceHashes.some(
                (refHash) => compareHashes(refHash, hash) <= similarityThreshold
              )
            ) {
              console.log("Image removed", img.src);
              hideTweet(tweetElement);
              chrome.runtime.sendMessage({
                action: "postRemoved",
                userId: userId,
              });
            }
          });
        }
      });
  }
}

function checkTextFilters(tweetText, userId, tweetElement) {
  filterCriteria.forEach((criteria) => {
    chrome.runtime.sendMessage(
      { action: "analyzeTweet", tweetText, filterCriteria: criteria },
      (response) => {
        if (chrome.runtime.lastError || response.error) return;
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
  const articleUserId = tweetElement
    .closest("article")
    ?.dataset.testid?.split("-")?.[1];
  if (articleUserId) return articleUserId;

  const userLink = tweetElement.querySelector('a[role="link"][href^="/"]');
  if (userLink) {
    const match = userLink.getAttribute("href").match(/^\/([^/]+)/);
    if (match) return match[1];
  }

  const dataUserId = tweetElement
    .querySelector('[data-testid^="UserAvatar-Container-"]')
    ?.dataset.testid?.split("-")
    .pop();
  if (dataUserId) return dataUserId;

  console.error("Could not find user ID for tweet:", tweetElement);
  return null;
}

function muteUser(userId) {
  const tweet = document.querySelector(
    `article[data-testid="tweet"][data-user-id="${userId}"]`
  );
  if (!tweet) {
    return;
  }

  const moreButton = findMoreButton(tweet);
  if (!moreButton) {
    return;
  }

  moreButton.click();

  setTimeout(() => {
    const muteOption = Array.from(
      document.querySelectorAll('div[role="menuitem"]')
    ).find((item) => item.textContent.toLowerCase().includes("mute"));

    if (muteOption) {
      muteOption.click();
    } else {
      console.log(
        `Mute option not found in the dropdown menu for user ID: ${userId}`
      );
    }
  }, 500);
}

function findMoreButton(tweet) {
  let moreButton = tweet.querySelector('div[aria-label="More"]');
  if (!moreButton) {
    const svgPath = tweet.querySelector(
      'svg path[d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"]'
    );
    if (svgPath) moreButton = svgPath.closest('div[role="button"]');
  }
  return moreButton;
}

function computeImageHash(image, size = 8) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = canvas.height = size;
  ctx.drawImage(image, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  return Array.from({ length: size * size }, (_, i) =>
    (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3 > 127 ? "1" : "0"
  ).join("");
}

function compareHashes(hash1, hash2) {
  return hash1.split("").reduce((diff, bit, i) => diff + (bit !== hash2[i]), 0);
}

function handlePastedImage(e) {
  const imageItem = Array.from(e.clipboardData.items).find((item) =>
    item.type.startsWith("image")
  );
  if (imageItem) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const referenceImageHash = computeImageHash(img);
        chrome.runtime.sendMessage(
          { action: "setReferenceHash", hash: referenceImageHash },
          (response) => {
            processTweetsForSimilarImages(referenceImageHash);
          }
        );
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(imageItem.getAsFile());
  }
}

function getHighQualityImageUrl(url) {
  const baseUrl = url.split("?")[0].replace(/=\d+x\d+$/, "");
  return `${baseUrl}?format=jpg&name=900x900`;
}

function processImage(url, callback) {
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = () => callback(computeImageHash(img));
  img.onerror = () => {
    console.error("Error loading image:", url);
    callback(null);
  };
  img.src = url;
}

document.addEventListener("paste", handlePastedImage);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "filtersUpdated") initializeExtension();
  else if (request.action === "removeCurrentPost") removeCurrentPost();
  else if (request.action === "toggleMuteCurrentUser") toggleMuteCurrentUser();
  else if (request.action === "muteUser") muteUser(request.userId);
  else if (request.action === "setReferenceHashes") {
    if (request.hashes && Array.isArray(request.hashes)) {
      referenceHashes = request.hashes;
      chrome.storage.local.set({ referenceHashes: referenceHashes }, () => {
        sendResponse({ status: "Hashes updated and saved" });
      });
    } else {
      sendResponse({ status: "Error: Invalid hashes received" });
    }
    return true; // Indicates that the response is asynchronous
  }
});

initializeExtension();
function removeCurrentPost() {
  const tweetElement = document.querySelector('article[data-testid="tweet"]');
  if (tweetElement) {
    const userId = getUserIdFromTweet(tweetElement);
    hideTweet(tweetElement);
    chrome.runtime.sendMessage({ action: "postRemoved", userId: userId });
  }
}

function toggleMuteCurrentUser() {
  const tweetElement = document.querySelector('article[data-testid="tweet"]');
  if (tweetElement) {
    const userId = getUserIdFromTweet(tweetElement);
    muteUser(userId);
  }
}
