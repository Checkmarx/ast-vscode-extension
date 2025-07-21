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

    checkIcon.addEventListener("click", () => {
      if (!serverEnabled) {
        return;
      }
      checkIcon.classList.add("hidden");
      uncheckIcon.classList.remove("hidden");
      currentState = false;
      vscode.postMessage({ type: "setOssRealtimeEnabled", value: false });
    });

    uncheckIcon.addEventListener("click", () => {
      if (!serverEnabled) {
        return;
      }
      checkIcon.classList.remove("hidden");
      uncheckIcon.classList.add("hidden");
      currentState = true;
      vscode.postMessage({ type: "setOssRealtimeEnabled", value: true });
    });

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

      if (message.type === "setOssRealtimeEnabledFromSettings") {
        if (!serverEnabled) {
          return;
        }
        if (message.value) {
          checkIcon.classList.remove("hidden");
          uncheckIcon.classList.add("hidden");
          currentState = true;
        } else {
          checkIcon.classList.add("hidden");
          uncheckIcon.classList.remove("hidden");
          currentState = false;
        }
      }
    });

    function handleSetAiFeatureState(message) {
      loader.classList.add("hidden");
      serverEnabled = message.enabled;

      if (message.enabled) {
        if (message.ossSetting) {
          checkIcon.classList.remove("hidden");
          uncheckIcon.classList.add("hidden");
          currentState = true;
        } else {
          checkIcon.classList.add("hidden");
          uncheckIcon.classList.remove("hidden");
          currentState = false;
        }

        checkIcon.style.cursor = "pointer";
        uncheckIcon.style.cursor = "pointer";
      } else {
        checkIcon.classList.add("hidden");
        uncheckIcon.classList.remove("hidden");
        aiBoxInfo.classList.remove("hidden");
        aiFeatureBoxWrapper.classList.remove("hidden");
        currentState = false;
      }

      vscode.setState({
        aiFeatureLoaded: true,
        lastAiState: message,
      });
    }
  });
})();
