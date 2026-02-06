const vscode = acquireVsCodeApi();

function decodePackageKey(encoded) {
  return atob(encoded);
}

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
  const reviveBtn = document.querySelector(
    `button[onclick="revivePackage('${packageKey}')"]`
  );
  if (reviveBtn && reviveBtn.classList.contains("disabled")) {
    return;
  }

  vscode.postMessage({ command: "revive", packageKey: decodePackageKey(packageKey) });
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
    updateReviveButtonsState(true);
  } else {
    selectionBar.style.display = "none";
    updateReviveButtonsState(false);
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
    decodePackageKey(checkbox.getAttribute("data-package-key"))
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
    decodePackageKey(checkbox.getAttribute("data-package-key"))
  );
}

function updateReviveButtonsState(hasSelections) {
  if (hasSelections) {
    const checkedBoxes = document.querySelectorAll(".row-checkbox:checked");
    const selectedPackageKeys = Array.from(checkedBoxes).map((checkbox) =>
      checkbox.getAttribute("data-package-key")
    );

    selectedPackageKeys.forEach((packageKey) => {
      const reviveBtn = document.querySelector(
        `button[onclick="revivePackage('${packageKey}')"]`
      );
      if (reviveBtn) {
        reviveBtn.classList.add("disabled");
        reviveBtn.setAttribute("disabled", "true");

        const tooltip = reviveBtn.closest(".revive-btn-tooltip");
        if (tooltip) {
          const tooltipText = tooltip.querySelector(".tooltiptext");
          if (tooltipText) {
            tooltipText.setAttribute(
              "data-original-text",
              tooltipText.textContent
            );
            tooltipText.textContent =
              'Use "Revive All" to revive selected vulnerabilities';
          }
        }
      }
    });
  } else {
    const allReviveButtons = document.querySelectorAll(".revive-btn");
    allReviveButtons.forEach((btn) => {
      btn.classList.remove("disabled");
      btn.removeAttribute("disabled");

      const tooltip = btn.closest(".revive-btn-tooltip");
      if (tooltip) {
        const tooltipText = tooltip.querySelector(".tooltiptext");
        if (tooltipText && tooltipText.getAttribute("data-original-text")) {
          tooltipText.textContent =
            tooltipText.getAttribute("data-original-text");
          tooltipText.removeAttribute("data-original-text");
        }
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", initializeView);
