(function () {
  const vscode = acquireVsCodeApi();
  const previousState = vscode.getState() || {};
  let currentState = false;
  let serverEnabled = false;

  window.addEventListener("DOMContentLoaded", () => {
    const checkIcon = document.getElementById("aiFeatureCheckIcon");
    const uncheckIcon = document.getElementById("aiFeatureUncheckIcon");
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

      if (newState) {
        checkIcon.classList.remove("hidden");
        uncheckIcon.classList.add("hidden");
      } else {
        checkIcon.classList.add("hidden");
        uncheckIcon.classList.remove("hidden");
      }

      checkIcon.setAttribute("aria-pressed", newState.toString());
      uncheckIcon.setAttribute("aria-pressed", (!newState).toString());

      vscode.postMessage({ type: "changeAllScannersStatus", value: newState });
    }

    checkIcon.addEventListener("click", () => toggleScannerState(false));
    uncheckIcon.addEventListener("click", () => toggleScannerState(true));

    function handleKeydown(event, targetState) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleScannerState(targetState);
      }
    }

    checkIcon.addEventListener("keydown", (event) =>
      handleKeydown(event, false)
    );
    uncheckIcon.addEventListener("keydown", (event) =>
      handleKeydown(event, true)
    );

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

      if (message.enabled) {
        toggleScannerState(message.scannersSettings);

        checkIcon.style.cursor = "pointer";
        uncheckIcon.style.cursor = "pointer";
      } else {
        toggleScannerState(false);
        aiBoxInfo.classList.remove("hidden");
        aiFeatureBoxWrapper.classList.remove("hidden");
      }

      vscode.setState({
        aiFeatureLoaded: true,
        lastAiState: message,
      });
    }
  });
})();
