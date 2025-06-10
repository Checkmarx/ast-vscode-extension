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

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "setAiFeatureState") {
        loader.classList.add("hidden");

        if (message.enabled) {
          currentState = true;
          checkIcon.classList.remove("hidden");
          uncheckIcon.classList.add("hidden");
          checkIcon.style.cursor = "pointer";
          vscode.postMessage({ type: "setOssRealtimeEnabled", value: true });
        } else {
          currentState = false;
          checkIcon.classList.add("hidden");
          aiBoxInfo.classList.remove("hidden");
          aiFeatureBoxWrapper.classList.remove("hidden");
          uncheckIcon.classList.remove("hidden");
          vscode.postMessage({ type: "setOssRealtimeEnabled", value: false });
        }
      }
    });
  });
})();
