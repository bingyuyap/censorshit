document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('filterCriteria');
  const saveButton = document.getElementById('saveButton');

  chrome.runtime.sendMessage({ action: "getFilterCriteria" }, (response) => {
    if (response) {
      textarea.value = response;
    }
  });

  saveButton.addEventListener('click', () => {
    const filterCriteria = textarea.value;
    chrome.runtime.sendMessage({ action: "updateFilterCriteria", filterCriteria }, (response) => {
      if (response && response.success) {
        alert('Filter criteria saved successfully!');
      } else {
        alert('Error saving filter criteria. Please try again.');
      }
    });
  });
});
