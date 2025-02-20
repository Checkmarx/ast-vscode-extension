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
		const authenticatedMessage = document.getElementById("authenticatedMessage");

		document.querySelectorAll('input[name="authMethod"]').forEach(radio => {
			radio.addEventListener("change", (e) => {
				const isOAuth = e.target.value === "oauth";
				document.getElementById("oauthForm").classList.toggle("hidden", !isOAuth);
				document.getElementById("apiKeyForm").classList.toggle("hidden", isOAuth);
				messageBox.style.display = "none";
				isBtnDisabled();
			});
		});

		authButton.addEventListener("click", () => {
			vscode.postMessage({
				command: "authenticate",
				authMethod: document.querySelector("input[name=\"authMethod\"]:checked").value,
				baseUri: urlInput.value,
				tenant: tenantInput.value,
				apiKey: document.getElementById("apiKey").value,
			});
		});

		function handleInputApiKey() {
			messageBox.style.display = "none";
			isBtnDisabled();
		}
		apiKeyInput.addEventListener("input", handleInputApiKey);

		function isBtnDisabled() {
			const authMethod = document.querySelector("input[name='authMethod']:checked").value;
			const hasValidUrl = errorMessage.style.display !== "block" && urlsList.style.display === "none" && urlInput.value.trim();
			const hasTenant = tenantInput.value.trim();
			const hasApiKey = apiKeyInput.value.trim();
			authButton.disabled = authMethod === "oauth" ? !(hasValidUrl && hasTenant) : !hasApiKey;
		}

		function showMessage(text, isError) {
			messageBox.textContent = text;
			messageBox.style.display = "block";
			messageBox.className = `message ${isError ? "error-message" : "success-message"}`;
		}


		window.addEventListener("message", (event) => {
			const message = event.data;
			if (message.type === 'setAuthState') {
				const logoutButton = document.getElementById('logoutButton');

				if (message.isAuthenticated) {
					loginForm.classList.add('hidden');
					authenticatedMessage.classList.remove('hidden');
					logoutButton.classList.remove('hidden');
				} else {
					loginForm.classList.remove('hidden');
					authenticatedMessage.classList.add('hidden');
					logoutButton.classList.add('hidden');
				}
				document.getElementById('logoutButton').addEventListener('click', () => {
					vscode.postMessage({ command: 'requestLogoutConfirmation' });
				});
			}
			else if (message.type === "urlValidationResult" && urlInput.value !== "" && !message.isValid) {
			errorMessage.textContent = "Invalid URL format";
			errorMessage.style.display = "block";
			isBtnDisabled();
		} else if (message.type === "validation-success" || message.type === "validation-error") {
			showMessage(message.message, message.type === "validation-error");
		}
	});

	function setupAutocomplete(inputElement, listElement, messageType, validateCallback) {
		window.addEventListener("message", event => {
			if (event.data.type === messageType) {
				const items = event.data.items;
				inputElement.addEventListener("input", function () {
					const query = this.value.toLowerCase();
					listElement.innerHTML = "";
					if (validateCallback) errorMessage.style.display = "none";
					messageBox.style.display = "none";

					if (!query) {
						listElement.style.display = "none";
						isBtnDisabled();
						return;
					}

					const filteredItems = items.filter(item => item.toLowerCase().includes(query));

					if (filteredItems.length === 0) {
						listElement.style.display = "none";
						if (validateCallback) validateCallback(query);
						isBtnDisabled();
						return;
					}

					listElement.style.display = "block";
					filteredItems.forEach(item => {
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
				if (validateCallback) validateCallback(inputElement.value);
				isBtnDisabled();
			}
		});
	}

	setupAutocomplete(urlInput, urlsList, "setUrls", query => vscode.postMessage({ command: "validateURL", baseUri: query }));
	setupAutocomplete(tenantInput, tenantList, "setTenants");
});
}) ();