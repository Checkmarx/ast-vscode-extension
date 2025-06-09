(function () {
  const vscode = acquireVsCodeApi();

  window.addEventListener("DOMContentLoaded", () => {
    vscode.postMessage({ type: "getAiFeatureState" });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "setAiFeatureState") {
        const icon = document.getElementById("aiFeatureIcon");
        if (!icon) {
          return;
        }

        const checkIconPath = icon.getAttribute("data-check") || "";
        const uncheckIconPath = icon.getAttribute("data-uncheck") || "";

        icon.setAttribute(
          "src",
          message.enabled ? checkIconPath : uncheckIconPath
        );

        icon.style.visibility = "visible";
      }
    });
  });
})();
