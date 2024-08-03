document.addEventListener("DOMContentLoaded", () => {
  const filterContainer = document.getElementById("filterContainer");
  const addFilterButton = document.getElementById("addFilterButton");
  const saveButton = document.getElementById("saveButton");
  const muteThresholdInput = document.getElementById("muteThreshold");

  // Load existing filters
  chrome.runtime.sendMessage({ action: "getFilterCriteria" }, (response) => {
    if (response && Array.isArray(response)) {
      response.forEach(createFilterInput);
    } else {
      createFilterInput(); // Create one empty filter input by default
    }
  });

  // Load existing mute threshold
  chrome.storage.sync.get("muteThreshold", (result) => {
    if (result.muteThreshold) {
      muteThresholdInput.value = result.muteThreshold;
    }
  });

  // Add new filter input
  addFilterButton.addEventListener("click", () => {
    createFilterInput();
  });

  // Update the save button click handler
  saveButton.addEventListener("click", () => {
    const filterInputs = document.querySelectorAll(".filter-input");
    const filterCriteria = Array.from(filterInputs)
      .map((input) => input.value.trim())
      .filter(Boolean);
    const muteThreshold = parseInt(muteThresholdInput.value, 10);

    chrome.storage.sync.set(
      {
        filterCriteria: filterCriteria,
        muteThreshold: muteThreshold,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          alert("Error saving settings. Please try again.");
        } else {
          alert("Settings saved successfully!");
        }
      }
    );
  });

  function createFilterInput(value = "") {
    const filterGroup = document.createElement("div");
    filterGroup.className = "filter-group";

    const filterInput = document.createElement("input");
    filterInput.type = "text";
    filterInput.className = "filter-input";
    filterInput.value = value;

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "-";
    deleteButton.className = "delete-filter";
    deleteButton.addEventListener("click", () => {
      filterContainer.removeChild(filterGroup);
    });

    filterGroup.appendChild(filterInput);
    filterGroup.appendChild(deleteButton);
    filterContainer.appendChild(filterGroup);
  }
});
