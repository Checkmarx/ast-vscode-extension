//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
	const vscode = acquireVsCodeApi();

	document.querySelector('.ast-node').addEventListener('click', (e) => {
		var target = e.target;
		vscode.postMessage({
			command: 'showFile',
			sourceFile: target.dataset.filename,
			path: target.dataset.filename,
			line: target.dataset.line,
			column: target.dataset.column,
		});
	});
}());