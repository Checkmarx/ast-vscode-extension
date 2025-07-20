const vscode = acquireVsCodeApi();

function refresh() {
  const refreshBtn = document.querySelector(".refresh-btn");
  if (
    refreshBtn &&
    !refreshBtn.disabled &&
    !refreshBtn.classList.contains("disabled")
  ) {
    vscode.postMessage({ command: "refresh" });
  }
}

function updateRefreshButtonState(hasPackages) {
  const refreshBtn = document.querySelector(".refresh-btn");
  if (refreshBtn) {
    if (hasPackages) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove("disabled");
    } else {
      refreshBtn.disabled = true;
      refreshBtn.classList.add("disabled");
    }
  }
}

function revivePackage(packageKey) {
  vscode.postMessage({ command: "revive", packageKey: packageKey });
}

function openFile(filePath, line) {
  vscode.postMessage({ command: "openFile", filePath: filePath, line: line });
}

function expandFiles(button) {
  const fileButtons = button.parentElement;
  fileButtons.classList.add("expanded");
}

function initializeView() {
  const tableRows = document.querySelectorAll(".table-row");
  tableRows.forEach((row) => {
    const packageIcon = row.querySelector(".package-severity-icon-large");

    if (packageIcon) {
      const originalSrc = packageIcon.src;
      const hoverSrc = packageIcon.getAttribute("data-hover-src");

      if (hoverSrc) {
        row.addEventListener("mouseenter", () => {
          packageIcon.src = hoverSrc;
        });

        row.addEventListener("mouseleave", () => {
          packageIcon.src = originalSrc;
        });
      }
    }
  });
}

window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.command) {
    case "updateButtonState":
      updateRefreshButtonState(message.hasPackages);
      break;
  }
});

function toggleMasterCheckbox(masterCheckbox) {
  const rowCheckboxes = document.querySelectorAll(".row-checkbox");
  const isChecked = masterCheckbox.checked;

  rowCheckboxes.forEach((checkbox) => {
    checkbox.checked = isChecked;
  });

  updateSelectionBar();
}

function updateMasterCheckbox() {
  const rowCheckboxes = document.querySelectorAll(".row-checkbox");
  const checkedBoxes = document.querySelectorAll(".row-checkbox:checked");
  const masterCheckbox = document.getElementById("master-checkbox");

  if (checkedBoxes.length === 0) {
    masterCheckbox.checked = false;
    masterCheckbox.indeterminate = false;
  } else if (checkedBoxes.length === rowCheckboxes.length) {
    masterCheckbox.checked = true;
    masterCheckbox.indeterminate = false;
  } else {
    masterCheckbox.checked = true;
    masterCheckbox.indeterminate = true;
  }

  updateSelectionBar();
}

function updateSelectionBar() {
  const checkedBoxes = document.querySelectorAll(".row-checkbox:checked");
  const selectionBar = document.getElementById("selection-bar");
  const selectionCount = document.getElementById("selection-count");

  if (checkedBoxes.length > 0) {
    selectionBar.style.display = "flex";
    selectionCount.textContent = `${checkedBoxes.length} Risk${
      checkedBoxes.length === 1 ? "" : "s"
    } selected`;
  } else {
    selectionBar.style.display = "none";
  }
}

function clearAllSelections() {
  const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
  allCheckboxes.forEach((checkbox) => {
    checkbox.checked = false;
    checkbox.indeterminate = false;
  });

  updateSelectionBar();
}

function reviveAllSelected() {
  const checkedBoxes = document.querySelectorAll(".row-checkbox:checked");
  const packageKeys = Array.from(checkedBoxes).map((checkbox) =>
    checkbox.getAttribute("data-package-key")
  );

  if (packageKeys.length > 0) {
    vscode.postMessage({
      command: "reviveMultiple",
      packageKeys: packageKeys,
    });
  }
}

function getSelectedPackageKeys() {
  const checkedBoxes = document.querySelectorAll(".row-checkbox:checked");
  return Array.from(checkedBoxes).map((checkbox) =>
    checkbox.getAttribute("data-package-key")
  );
}

document.addEventListener("DOMContentLoaded", initializeView);
