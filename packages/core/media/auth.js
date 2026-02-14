(function () {
  document.addEventListener("DOMContentLoaded", function () {
    const vscode = acquireVsCodeApi();
    const authButton = document.getElementById("authButton");
    const messageBox = document.getElementById("messageBox");
    const urlInput = document.getElementById("baseUri");
    const urlsList = document.getElementById("urls-list");
    const tenantInput = document.getElementById("tenant");
    const tenantList = document.getElementById("tenants-list");
    const errorMessage = document.getElementById("urlError");
    const apiKeyInput = document.getElementById("apiKey");
    const loginForm = document.getElementById("loginForm");
    const authenticatedMessage = document.getElementById(
      "authenticatedMessage",
    );

    // Get the auth method from hidden input (set by sidebar view) or determine from visible forms
    function getAuthMethod() {
      const authMethodInput = document.getElementById("authMethodInput");
      if (authMethodInput && authMethodInput.value) {
        return authMethodInput.value;
      }
      // Fallback: check which form is visible
      const oauthForm = document.getElementById("oauthForm");
      const apiKeyForm = document.getElementById("apiKeyForm");
      const oauthVisible = oauthForm && !oauthForm.classList.contains("hidden");
      const apiKeyVisible =
        apiKeyForm && !apiKeyForm.classList.contains("hidden");

      // If only one form is visible, return that method
      if (oauthVisible && !apiKeyVisible) return "oauth";
      if (apiKeyVisible && !oauthVisible) return "apiKey";

      // If both forms are visible, determine based on which has content
      if (apiKeyInput && apiKeyInput.value.trim()) return "apiKey";
      return "oauth";
    }

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.command === "disableAuthButton") {
        const authButton = document.getElementById("authButton");
        if (authButton) {
          authButton.disabled = true;
          if (apiKeyInput) apiKeyInput.disabled = true;
          if (urlInput) urlInput.disabled = true;
          if (tenantInput) tenantInput.disabled = true;
        }
      }

      if (message.command === "enableAuthButton") {
        const authButton = document.getElementById("authButton");
        if (authButton) {
          authButton.disabled = false;
          if (apiKeyInput) apiKeyInput.disabled = false;
          if (urlInput) urlInput.disabled = false;
          if (tenantInput) tenantInput.disabled = false;
        }
      }
      // Allow host to force the visible form (e.g., from sidebar navigation)
      if (message.type === "setAuthMethod" && (message.method === "oauth" || message.method === "apiKey")) {
        setAuthMethod(message.method);
      }
    });

    // Centralized toggle logic so radios and links reuse the same behavior
    function setAuthMethod(method) {
      const isOAuth = method === "oauth";
      document.getElementById("oauthForm")?.classList.toggle("hidden", !isOAuth);
      document.getElementById("apiKeyForm")?.classList.toggle("hidden", isOAuth);
      messageBox.style.display = "none";
      const authMethodInput = document.getElementById("authMethodInput");
      if (authMethodInput) authMethodInput.value = method;
      isBtnDisabled();
    }

    // Only add radio button listeners if they exist (for backward compatibility)
    document.querySelectorAll('input[name="authMethod"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const method = e.target.value === "oauth" ? "oauth" : "apiKey";
        setAuthMethod(method);
      });
    });

    if (authButton) {
      authButton.addEventListener("click", () => {
        messageBox.style.display = "none";

        vscode.postMessage({
          command: "authenticate",
          authMethod: getAuthMethod(),
          baseUri: urlInput ? urlInput.value : "",
          tenant: tenantInput ? tenantInput.value : "",
          apiKey: apiKeyInput ? apiKeyInput.value : "",
        });
      });
    }

    function handleInputApiKey() {
      messageBox.style.display = "none";
      isBtnDisabled();
    }
    if (apiKeyInput) {
      apiKeyInput.addEventListener("input", handleInputApiKey);
    }

    function isBtnDisabled() {
      if (!authButton) return;

      const authMethod = getAuthMethod();
      const oauthForm = document.getElementById("oauthForm");
      const apiKeyForm = document.getElementById("apiKeyForm");
      const oauthVisible = oauthForm && !oauthForm.classList.contains("hidden");
      const apiKeyVisible =
        apiKeyForm && !apiKeyForm.classList.contains("hidden");

      const hasValidUrl =
        urlInput &&
        errorMessage.style.display !== "block" &&
        urlsList.style.display === "none" &&
        urlInput.value.trim();
      const hasTenant = tenantInput && tenantInput.value.trim();
      const hasApiKey = apiKeyInput && apiKeyInput.value.trim();

      // If only OAuth form is visible
      if (oauthVisible && !apiKeyVisible) {
        authButton.disabled = !(hasValidUrl && hasTenant);
      }
      // If only API Key form is visible
      else if (apiKeyVisible && !oauthVisible) {
        authButton.disabled = !hasApiKey;
      }
      // If both forms are visible, enable if either condition is met
      else {
        authButton.disabled =
          authMethod === "oauth" ? !(hasValidUrl && hasTenant) : !hasApiKey;
      }
    }

    function showMessage(text, isError) {
      document.getElementById("messageText").textContent = text;
      messageBox.style.display = "flex";
      if (isError) {
        messageBox.className = "message error-message";
        document.getElementById("messageSuccessIcon").classList.add("hidden");
        document.getElementById("messageErrorIcon").classList.remove("hidden");
      } else {
        messageBox.className = "message success-message";
        document.getElementById("messageErrorIcon").classList.add("hidden");
        document
          .getElementById("messageSuccessIcon")
          .classList.remove("hidden");
      }
    }

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message.type === "setAuthState") {
        const logoutButton = document.getElementById("logoutButton");

        if (message.isAuthenticated) {
          loginForm.classList.add("hidden");
          authenticatedMessage.classList.remove("hidden");
          logoutButton.classList.remove("hidden");
          messageBox.style.display = "none";
        } else {
          loginForm.classList.remove("hidden");
          authenticatedMessage.classList.add("hidden");
          logoutButton.classList.add("hidden");
        }
        logoutButton.replaceWith(logoutButton.cloneNode(true));
        document
          .getElementById("logoutButton")
          .addEventListener("click", () => {
            vscode.postMessage({ command: "requestLogoutConfirmation" });
          });
      } else if (message.type === "showLoader") {
        document.getElementById("loading").classList.remove("hidden");
        document.getElementById("authContainer").classList.add("hidden");
      } else if (message.type === "hideLoader") {
        document.getElementById("loading").classList.add("hidden");
        document.getElementById("authContainer").classList.remove("hidden");
      } else if (
        message.type === "urlValidationResult" &&
        urlInput.value !== "" &&
        !message.isValid
      ) {
        errorMessage.textContent = "Invalid URL format";
        errorMessage.style.display = "block";
        isBtnDisabled();
      } else if (
        message.type === "validation-success" ||
        message.type === "validation-error"
      ) {
        showMessage(message.message, message.type === "validation-error");
      } else if (message.type === "clear-message-api-validation") {
        messageBox.style.display = "none";
      } else if (message.type === "clearFields") {
        // Clear radio buttons if they exist (backward compatibility)
        const oauthRadio = document.querySelector(
          'input[name="authMethod"][value="oauth"]',
        );
        const apiKeyRadio = document.querySelector(
          'input[name="authMethod"][value="apiKey"]',
        );
        if (oauthRadio) oauthRadio.checked = true;
        if (apiKeyRadio) apiKeyRadio.checked = false;

        // Clear form fields
        if (apiKeyInput) apiKeyInput.value = "";
        if (urlInput) urlInput.value = "";
        if (tenantInput) tenantInput.value = "";
        if (authButton) authButton.disabled = true;

        // Clear hidden auth method input
        const authMethodInput = document.getElementById("authMethodInput");
        if (authMethodInput) authMethodInput.value = "";

        // Dispatch change event if radio exists
        if (oauthRadio) {
          oauthRadio.dispatchEvent(new Event("change"));
        }
      }
    });

    function setupAutocomplete(
      inputElement,
      listElement,
      messageType,
      validateCallback,
    ) {
      window.addEventListener("message", (event) => {
        if (event.data.type === messageType) {
          const items = event.data.items;
          inputElement.addEventListener("input", function () {
            const query = this.value.toLowerCase();
            listElement.innerHTML = "";
            if (validateCallback) {
              errorMessage.style.display = "none";
            }
            messageBox.style.display = "none";

            if (!query) {
              listElement.style.display = "none";
              isBtnDisabled();
              return;
            }

            const filteredItems = items.filter((item) =>
              item.toLowerCase().includes(query),
            );

            if (filteredItems.length === 0) {
              listElement.style.display = "none";
              if (validateCallback) {
                validateCallback(query);
              }
              isBtnDisabled();
              return;
            }

            listElement.style.display = "block";
            filteredItems.forEach((item) => {
              const div = document.createElement("div");
              div.classList.add("autocomplete-item");
              div.innerHTML = `<i class="fas fa-check-circle"></i> ${item}`;
              div.addEventListener("click", function () {
                inputElement.value = item;
                listElement.innerHTML = "";
                listElement.style.display = "none";
                isBtnDisabled();
              });
              listElement.appendChild(div);
            });
            isBtnDisabled();
          });
        }
      });

      document.addEventListener("click", function (event) {
        if (event.target !== inputElement) {
          listElement.innerHTML = "";
          listElement.style.display = "none";
          if (validateCallback) {
            validateCallback(inputElement.value);
          }
          isBtnDisabled();
        }
      });
    }

    setupAutocomplete(urlInput, urlsList, "setUrls", (query) =>
      vscode.postMessage({ command: "validateURL", baseUri: query }),
    );
    setupAutocomplete(tenantInput, tenantList, "setTenants");
  });
})();
