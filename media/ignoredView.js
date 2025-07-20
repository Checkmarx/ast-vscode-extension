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

document.addEventListener("DOMContentLoaded", initializeView);
