(function () {
  const vscode = acquireVsCodeApi();

  window.addEventListener("DOMContentLoaded", () => {
    vscode.postMessage({ type: "getAiFeatureState" });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "setAiFeatureState") {
        const loader = document.getElementById("aiFeatureLoader");
        const icon = document.getElementById("aiFeatureIcon");

        if (!icon || !loader) {
          return;
        }

        loader.style.display = "none";
        icon.classList.remove("hidden");

        const checkIconPath = icon.getAttribute("data-check") || "";
        const uncheckIconPath = icon.getAttribute("data-uncheck") || "";

        icon.setAttribute(
          "src",
          message.enabled ? checkIconPath : uncheckIconPath
        );
      }
    });
  });
})();
