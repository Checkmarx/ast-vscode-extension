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
}());