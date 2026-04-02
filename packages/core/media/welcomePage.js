(function () {
  const vscode = acquireVsCodeApi();
  const previousState = vscode.getState() || {};
  let currentState = false;
  let serverEnabled = false;

  window.addEventListener("DOMContentLoaded", () => {
    const checkbox = document.getElementById("aiFeatureToggle");
    const loader = document.getElementById("aiFeatureLoader");
    const aiBoxInfo = document.getElementById("aiFeatureStatusBox");
    const aiFeatureBoxWrapper = document.getElementById("aiFeatureBoxWrapper");

    const closeButton = document.getElementById("closeButton");
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        vscode.postMessage({ type: "close" });
      });
    }

    function toggleScannerState(newState) {
      if (!serverEnabled) {
        return;
      }

      currentState = newState;

      if (checkbox) {
        checkbox.checked = newState;
      }

      vscode.postMessage({ type: "changeAllScannersStatus", value: newState });
    }

    if (checkbox) {
      checkbox.addEventListener("change", () => {
        if (!serverEnabled) {
          checkbox.checked = false;
          return;
        }
        toggleScannerState(checkbox.checked);
      });
    }

    if (previousState.aiFeatureLoaded) {
      loader.classList.add("hidden");
      handleSetAiFeatureState(previousState.lastAiState);
    } else {
      loader.classList.remove("hidden");
      vscode.postMessage({ type: "getAiFeatureState" });
    }

    window.addEventListener("message", (event) => {
      const message = event.data;

      if (message.type === "setAiFeatureState") {
        handleSetAiFeatureState(message);
      }
    });

    function handleSetAiFeatureState(message) {
      loader.classList.add("hidden");
      serverEnabled = message.enabled;
      if (checkbox) {
        checkbox.classList.remove("hidden");
      }

      const card = document.getElementById("aiFeatureCard");
      const isAiDisabledByMissingExtension = card && card.classList.contains("feature-card-ai-disabled");

      if (!message.enabled) {
        // MCP server disabled at tenant level: uncheck and disable, show error icon
        toggleScannerState(false);
        if (checkbox) {
          checkbox.disabled = true;
        }
        aiBoxInfo.classList.remove("hidden");
        aiFeatureBoxWrapper.classList.remove("hidden");
      } else if (isAiDisabledByMissingExtension) {
        // No AI extension installed: show checked but grey/disabled checkbox (tick visible, not clickable)
        if (checkbox) {
          checkbox.checked = true;
          checkbox.disabled = true;
        }
      } else {
        toggleScannerState(message.scannersSettings);
        if (checkbox) {
          checkbox.disabled = false;
          checkbox.style.cursor = "pointer";
        }
      }

      vscode.setState({
        aiFeatureLoaded: true,
        lastAiState: message,
      });
    }
  });
})();
