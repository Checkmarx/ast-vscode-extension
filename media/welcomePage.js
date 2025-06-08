(function () {
  const vscode = acquireVsCodeApi();

  window.addEventListener("DOMContentLoaded", () => {
    vscode.postMessage({ type: "getAiFeatureState" });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "setAiFeatureState") {
        const aiFeatureIcon = document.getElementById("aiFeatureIcon");

        if (message.enabled) {
          aiFeatureIcon.classList.remove("off");
          aiFeatureIcon.classList.add("on");
        } else {
          aiFeatureIcon.classList.remove("on");
          aiFeatureIcon.classList.add("off");
        }
      }
    });
  });
})();
