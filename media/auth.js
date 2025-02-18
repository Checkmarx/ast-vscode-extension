(function () {
	document.addEventListener("DOMContentLoaded", function () {
	const vscode = acquireVsCodeApi();
	const authButton = document.getElementById('authButton');
	const messageBox = document.getElementById('messageBox');

	document.querySelectorAll('input[name="authMethod"]').forEach(radio => {
		radio.addEventListener('change', (e) => {
			const isOAuth = e.target.value === 'oauth';
			document.getElementById('oauthForm').classList.toggle('hidden', !isOAuth);
			document.getElementById('apiKeyForm').classList.toggle('hidden', isOAuth);
			authButton.textContent = isOAuth ? 'Sign in to Checkmarx' : 'Validate Connection';
			messageBox.style.display = 'none';
			isBtnDisabled();
		});
	});

	authButton.addEventListener('click', () => {
		const authMethod = document.querySelector('input[name="authMethod"]:checked').value;
		const baseUri = document.getElementById('baseUri').value;
		const tenant = document.getElementById('tenant').value;
		const apiKey = document.getElementById('apiKey').value;

		vscode.postMessage({
			command: 'authenticate',
			authMethod,
			baseUri,
			tenant,
			apiKey
		});
	});

	document.getElementById('apiKey').addEventListener('input', isBtnDisabled);

	function isBtnDisabled() {
		const authMethod = document.querySelector('input[name="authMethod"]:checked').value;
		if (authMethod === 'oauth') {
		const urlInput = document.getElementById('baseUri').value;
		const tenantInput = document.getElementById('tenant').value;
		const urlsList = document.getElementById("urls-list");
		const isInputedValidUrl = document.getElementById('urlError').style.display!=="block"&&urlsList.style.display === "none"?true:false;
		const authButton = document.getElementById('authButton');
		if (urlInput !== "" && isInputedValidUrl && tenantInput !== "") {
			authButton.disabled = false;
		}
		else {
			authButton.disabled = true;
		}
	}else{
		if (document.getElementById('apiKey').value !== "" ) {
			authButton.disabled = false;
		}
		else {
			authButton.disabled = true;
		}
	}
	}
	window.addEventListener('message', (event) => {
		const message = event.data;
		{
			messageBox.textContent = message.message;
			messageBox.style.display = 'block';
			messageBox.className = 'message ' +
				(message.type === 'validation-error' ? 'error-message' : 'success-message');
		}
	});

	
		function checkValidation(query) {
			vscode.postMessage({ command: 'validateURL', baseUri: query });
		}
		const urlInput = document.getElementById("baseUri");
		const urlsList = document.getElementById("urls-list");
		const tenantInput = document.getElementById("tenant");
		const tenantList = document.getElementById("tenants-list");
		const errorMessage = document.getElementById("urlError");

		window.addEventListener('message', event => {
			const message = event.data;
			if (message.command === 'urlValidationResult') {
				if (!message.isValid) {
					errorMessage.textContent = "Invalid URL format";
					errorMessage.style.display = "block";
				}
			}
			if (message.type === 'setUrls') {
				const items = message.items;

				urlInput.addEventListener("input", function () {
					const query = this.value.toLowerCase();
					urlsList.innerHTML = "";
					errorMessage.style.display = "none";


					if (!query) {
						urlsList.style.display = "none";
						isBtnDisabled();
						return;
					}

					const filteredItems = items.filter(item => item.toLowerCase().includes(query));
					if (filteredItems.length === 0) {
						urlsList.style.display = "none";
						checkValidation(query);
						return;
					}

					urlsList.style.display = "block";

					filteredItems.forEach(item => {
						const div = document.createElement("div");
						div.classList.add("autocomplete-item");
						div.innerHTML = `<i class="fas fa-check-circle"></i> ${item}`;
						div.addEventListener("click", function () {
							urlInput.value = item;
							urlsList.innerHTML = "";
							urlsList.style.display = "none";
					isBtnDisabled();
						});
						urlsList.appendChild(div);
					});
					isBtnDisabled();
				});

				document.addEventListener("click", function (event) {
					if (event.target !== urlInput) {
						urlsList.innerHTML = "";
						urlsList.style.display = "none";
						isBtnDisabled();
					}
				});
			}	
			else if (message.type === 'setTenants') {
				const items = message.items;

				tenantInput.addEventListener("input", function () {
					const query = this.value.toLowerCase();
					tenantList.innerHTML = "";


					if (!query) {
						tenantList.style.display = "none";
						isBtnDisabled();
						return;
					}

					const filteredItems = items.filter(item => item.toLowerCase().includes(query));
					if (filteredItems.length === 0) {
						tenantList.style.display = "none";
					isBtnDisabled();
						return;
					}

					tenantList.style.display = "block";

					filteredItems.forEach(item => {
						const div = document.createElement("div");
						div.classList.add("autocomplete-item");
						div.innerHTML = `<i class="fas fa-check-circle"></i> ${item}`;
						div.addEventListener("click", function () {
							tenantInput.value = item;
							tenantList.innerHTML = "";
							tenantList.style.display = "none";
					isBtnDisabled();
						});
						tenantList.appendChild(div);
					});
					isBtnDisabled();
				});

				document.addEventListener("click", function (event) {
					if (event.target !== tenantInput) {
						tenantList.innerHTML = "";
						tenantList.style.display = "none";
						isBtnDisabled();
					}
				});
			}
		});
	});

}());