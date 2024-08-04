document.addEventListener("DOMContentLoaded", () => {
  const filterContainer = document.getElementById("filterContainer");
  const addFilterButton = document.getElementById("addFilterButton");
  const saveButton = document.getElementById("saveButton");
  const muteThresholdInput = document.getElementById("muteThreshold");
  const imageUrlInput = document.getElementById("imageUrlInput");
  const addImageButton = document.getElementById("addImageButton");
  const imageContainer = document.getElementById("imageContainer");

  let imageHashPairs = [];

  // Load existing filters
  chrome.runtime.sendMessage({ action: "getFilterCriteria" }, (response) => {
    if (response && Array.isArray(response)) {
      response.forEach(createFilterInput);
    } else {
      createFilterInput(); // Create one empty filter input by default
    }
  });

  // Load existing mute threshold
  chrome.storage.local.get("muteThreshold", (result) => {
    if (result.muteThreshold) {
      muteThresholdInput.value = result.muteThreshold;
    }
  });

  // Load existing image-hash pairs
  chrome.storage.local.get("imageHashPairs", (result) => {
    if (result.imageHashPairs && Array.isArray(result.imageHashPairs)) {
      imageHashPairs = result.imageHashPairs;
      refreshImageContainer();
    }
  });

  addFilterButton.addEventListener("click", () => {
    createFilterInput();
  });
  saveButton.addEventListener("click", () => {
    saveSettings();
  });
  addImageButton.addEventListener("click", () => {
    handleAddImage();
  });

  function saveSettings() {
    const filterInputs = document.querySelectorAll(".filter-input");
    const filterCriteria = Array.from(filterInputs)
      .map((input) => input.value.trim())
      .filter(Boolean);
    const muteThreshold = parseInt(muteThresholdInput.value, 10);

    chrome.storage.local.set(
      {
        filterCriteria: filterCriteria,
        muteThreshold: muteThreshold,
        imageHashPairs: imageHashPairs,
      },
      () => {
        if (chrome.runtime.lastError) {
          alert("Error saving settings. Please try again.");
        } else {
          updateReferenceHashes();
        }
      }
    );
  }

  function handleAddImage() {
    const imageUrl = imageUrlInput.value.trim();
    if (imageUrl) {
      computeImageHash(imageUrl)
        .then((hash) => {
          imageHashPairs.push({ imageUrl, hash });
          refreshImageContainer();
          imageUrlInput.value = ""; // Clear the input
          saveSettings();
        })
        .catch((error) => {
          console.error("Error processing image:", error);
          alert("Error processing image. Please check the URL and try again.");
        });
    } else {
      alert("Please enter a valid image URL.");
    }
  }

  function refreshImageContainer() {
    imageContainer.innerHTML = "";
    imageHashPairs.forEach((pair, index) =>
      addImageToContainer(pair.imageUrl, index)
    );
  }

  function addImageToContainer(imageUrl, index) {
    const imageItem = document.createElement("div");
    imageItem.className = "image-item";

    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = `Reference image ${index + 1}`;

    const removeButton = document.createElement("button");
    removeButton.textContent = "X";
    removeButton.className = "remove-image";
    removeButton.addEventListener("click", () => removeImage(index));

    imageItem.appendChild(img);
    imageItem.appendChild(removeButton);
    imageContainer.appendChild(imageItem);
  }

  function removeImage(index) {
    imageHashPairs.splice(index, 1);
    refreshImageContainer();
    saveSettings();
  }

  function updateReferenceHashes() {
    const hashes = imageHashPairs.map((pair) => pair.hash);
    chrome.runtime.sendMessage({
      action: "setReferenceHashes",
      hashes: hashes,
    });

    // Also update content scripts in all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          action: "setReferenceHashes",
          hashes: hashes,
        });
      });
    });
  }

  function computeImageHash(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = function () {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 8;
        canvas.height = 8;
        ctx.drawImage(img, 0, 0, 8, 8);
        const data = ctx.getImageData(0, 0, 8, 8).data;
        let hash = "";
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          hash += avg > 127 ? "1" : "0";
        }
        resolve(hash);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageUrl;
    });
  }

  function createFilterInput(value = "") {
    const filterGroup = document.createElement("div");
    filterGroup.className = "filter-group";

    const filterInput = document.createElement("input");
    filterInput.type = "text";
    filterInput.className = "filter-input";
    filterInput.value = value;

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "X";
    deleteButton.className = "delete-filter";
    deleteButton.addEventListener("click", () =>
      filterContainer.removeChild(filterGroup)
    );

    filterGroup.appendChild(filterInput);
    filterGroup.appendChild(deleteButton);
    filterContainer.appendChild(filterGroup);
  }
});
