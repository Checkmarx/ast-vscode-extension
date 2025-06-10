(function () {
  const vscode = acquireVsCodeApi();
  let currentState = false;

  window.addEventListener("DOMContentLoaded", () => {
    vscode.postMessage({ type: "getAiFeatureState" });

    const checkIcon = document.getElementById("aiFeatureCheckIcon");
    const uncheckIcon = document.getElementById("aiFeatureUncheckIcon");
    const loader = document.getElementById("aiFeatureLoader");
    const aiBoxInfo = document.getElementById("aiFeatureStatusBox");
    const aiFeatureBoxWrapper = document.getElementById("aiFeatureBoxWrapper");

    checkIcon.addEventListener("click", () => {
      if (!currentState) {
        return;
      }

      checkIcon.classList.add("hidden");
      uncheckIcon.classList.remove("hidden");
      currentState = false;
      vscode.postMessage({ type: "setOssRealtimeEnabled", value: false });
    });

    uncheckIcon.addEventListener("click", () => {
      if (!currentState) {
        return;
      }

      checkIcon.classList.remove("hidden");
      uncheckIcon.classList.add("hidden");
      vscode.postMessage({ type: "setOssRealtimeEnabled", value: true });
    });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "setAiFeatureState") {
        loader.classList.add("hidden");

        if (message.enabled) {
          currentState = true;
          checkIcon.style.cursor = "pointer";
          uncheckIcon.style.cursor = "pointer";

          if (message.ossSetting) {
            checkIcon.classList.remove("hidden");
            uncheckIcon.classList.add("hidden");
          } else {
            checkIcon.classList.add("hidden");
            uncheckIcon.classList.remove("hidden");
          }
        } else {
          currentState = false;
          checkIcon.classList.add("hidden");
          uncheckIcon.classList.remove("hidden");
          aiBoxInfo.classList.remove("hidden");
          aiFeatureBoxWrapper.classList.remove("hidden");
        }
      }
    });
  });
})();
