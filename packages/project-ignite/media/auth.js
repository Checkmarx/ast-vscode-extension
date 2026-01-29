(function () {
  document.addEventListener("DOMContentLoaded", function () {
    const vscode = acquireVsCodeApi();
    const authButton = document.getElementById("authButton");
    const messageBox = document.getElementById("messageBox");
    const apiKeyInput = document.getElementById("apiKey");
    const loginForm = document.getElementById("loginForm");
    const authenticatedMessage = document.getElementById("authenticatedMessage");
    const logoutButton = document.getElementById("logoutButton");
    const loading = document.getElementById("loading");
    const authContainer = document.getElementById("authContainer");
    const messageText = document.getElementById("messageText");
    const messageSuccessIcon = document.getElementById("messageSuccessIcon");
    const messageErrorIcon = document.getElementById("messageErrorIcon");

    // Single message handler for all messages
    window.addEventListener("message", (event) => {
      const message = event.data;

      if (message.command === "disableAuthButton") {
        authButton.disabled = true;
        apiKeyInput.disabled = true;
      }

      if (message.command === "enableAuthButton") {
        authButton.disabled = false;
        apiKeyInput.disabled = false;
      }

      if (message.type === "hideLoading") {
        loading.classList.add("hidden");
        authContainer.classList.remove("hidden");
      }

      if (message.type === "setAuthState") {
        if (message.isAuthenticated) {
          loginForm.classList.add("hidden");
          authenticatedMessage.classList.remove("hidden");
          logoutButton.classList.remove("hidden");
        } else {
          loginForm.classList.remove("hidden");
          authenticatedMessage.classList.add("hidden");
          logoutButton.classList.add("hidden");
        }
      }

      if (message.type === "validation-error") {
        messageBox.style.display = "flex";
        messageBox.classList.remove("success-message");
        messageBox.classList.add("error-message");
        messageText.textContent = message.message;
        messageSuccessIcon.classList.add("hidden");
        messageErrorIcon.classList.remove("hidden");
      }

      if (message.type === "validation-success") {
        messageBox.style.display = "flex";
        messageBox.classList.remove("error-message");
        messageBox.classList.add("success-message");
        messageText.textContent = message.message;
        messageErrorIcon.classList.add("hidden");
        messageSuccessIcon.classList.remove("hidden");
      }

      if (message.type === "authenticated") {
        loginForm.classList.add("hidden");
        authenticatedMessage.classList.remove("hidden");
        logoutButton.classList.remove("hidden");
        messageBox.style.display = "none";
      }

      if (message.type === "unauthenticated") {
        loginForm.classList.remove("hidden");
        authenticatedMessage.classList.add("hidden");
        logoutButton.classList.add("hidden");
        messageBox.style.display = "none";
        apiKeyInput.value = "";
        authButton.disabled = true;
      }

      if (message.type === "clear-message-api-validation") {
        messageBox.style.display = "none";
      }

      if (message.type === "clearFields") {
        apiKeyInput.value = "";
        authButton.disabled = true;
      }
    });

    authButton.addEventListener("click", () => {
      messageBox.style.display = "none";

      vscode.postMessage({
        command: "authenticate",
        apiKey: apiKeyInput.value,
      });
    });

    function handleInputApiKey() {
      messageBox.style.display = "none";
      isBtnDisabled();
    }
    apiKeyInput.addEventListener("input", handleInputApiKey);

    function isBtnDisabled() {
      const hasApiKey = apiKeyInput.value.trim();
      authButton.disabled = !hasApiKey;
    }

    logoutButton.addEventListener("click", () => {
      vscode.postMessage({
        command: "requestLogoutConfirmation",
      });
    });
  });
})();

