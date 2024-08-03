document.addEventListener("DOMContentLoaded", () => {
  const filterContainer = document.getElementById("filterContainer");
  const addFilterButton = document.getElementById("addFilterButton");
  const saveButton = document.getElementById("saveButton");

  // Load existing filters
  chrome.runtime.sendMessage({ action: "getFilterCriteria" }, (response) => {
    if (response && Array.isArray(response)) {
      response.forEach(createFilterInput);
    } else {
      createFilterInput(); // Create one empty filter input by default
    }
  });

  // Add new filter input
  addFilterButton.addEventListener("click", () => {
    createFilterInput();
  });

  // Save filters
  saveButton.addEventListener("click", () => {
    const filterInputs = document.querySelectorAll(".filter-input");
    const filterCriteria = Array.from(filterInputs)
      .map((input) => input.value.trim())
      .filter(Boolean);

    chrome.runtime.sendMessage(
      { action: "updateFilterCriteria", filterCriteria },
      (response) => {
        if (response && response.success) {
          alert("Filter criteria saved successfully!");
        } else {
          alert("Error saving filter criteria. Please try again.");
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
