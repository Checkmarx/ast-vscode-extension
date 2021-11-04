//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
	const vscode = acquireVsCodeApi();

	document.querySelector('.ast-search').addEventListener('click', () => {
		const scanID = document.getElementById("scanID").value;
		vscode.postMessage({
			command: 'loadASTResults',
			scanID: scanID
		});
	});
	document.querySelector('.ast-settings').addEventListener('click', () => {
		vscode.postMessage({
			command: 'settings'
		});
	});

	document.querySelector('.ast-project').addEventListener('change', () => {
		const projectID = document.getElementById("projectID").value;
		vscode.postMessage({
			command: 'projectSelected',
			projectID: projectID,
		});
	});

	document.querySelector('.ast-scans').addEventListener('change', () => {
		const selectedScanID = document.getElementById("scans").value;
		const scanID = document.getElementById("scanID");
		scanID.value = selectedScanID;
		vscode.postMessage({
			command: 'scanSelected',
			selectedScanID: selectedScanID,
		});
	});

	document.querySelector('.ast-clear').addEventListener('click', () => {
		const scanID = document.getElementById("scanID");
		scanID.value = '';
		vscode.postMessage({
			command: 'clear'
		});
	});
	window.addEventListener('message', event => {
		const scans = event.data;
		const selectElement = document.getElementById("scans");
		selectElement.options.length = 0;
		if(scans.scans.length > 0) {
			selectElement.disabled = false;
		const defaultOption = document.createElement("option");
		defaultOption.text = "Select a scan";
		defaultOption.value = "";
		defaultOption.disabled =	true;
		defaultOption.selected =	true;
		selectElement.add(defaultOption);
		for(var scan in scans.scans) {
			//append options
			const option = document.createElement("option");
			//const optionText = document.createTextNode(scans.scans[scan].name);
			const optionText = document.createTextNode(scans.scans[scan].CreatedAt);
			option.appendChild(optionText);
			//option.setAttribute("value", scans.scans[scan].id);
			option.setAttribute("value", scans.scans[scan].ID);
			selectElement.appendChild(option);
			console.log(scan);
		}
		}
		else {
		const defaultOption = document.createElement("option");
		defaultOption.text = "No scans found for project";
		defaultOption.value = "";
		defaultOption.disabled =	true;
		defaultOption.selected =	true;
		selectElement.add(defaultOption);
		selectElement.disabled = true;
		const scanID = document.getElementById("scanID");
		scanID.value = '';
		}
		
	});
	window.addEventListener('message', event => {

		const message = event.data; // The JSON data our extension sent

		switch (message.instruction) {
			case 'clear ID':
				const scanID = document.getElementById("scanID");
				scanID.value = '';
				break;
		}
	});
}());