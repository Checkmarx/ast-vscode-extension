(function () {
  const vscode = acquireVsCodeApi();

  let currentState = false;

  window.addEventListener("DOMContentLoaded", () => {
    vscode.postMessage({ type: "getAiFeatureState" });

    const checkIcon = document.getElementById("aiFeatureCheckIcon");
    const uncheckIcon = document.getElementById("aiFeatureUncheckIcon");
    const loader = document.getElementById("aiFeatureLoader");

    checkIcon.addEventListener("click", () => {
      if (!currentState) {
        return;
      }
      checkIcon.classList.add("hidden");
      uncheckIcon.classList.remove("hidden");
      currentState = false;
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
        } else {
          currentState = false;
          checkIcon.classList.add("hidden");
          uncheckIcon.classList.remove("hidden");
        }
      }
    });
  });
})();
