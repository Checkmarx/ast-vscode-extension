//@ts-check
// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
	var selectSeverity="";
	var selectState="";
	// @ts-ignore
	const vscode = acquireVsCodeApi();
	document.querySelectorAll('.ast-node').forEach(element => {
		element.addEventListener('click', (e) => {
			var target = e.target;
			vscode.postMessage({
				command: 'showFile',
				// @ts-ignore
				sourceFile: target.dataset.filename,
				// @ts-ignore
				path: target.dataset.filename,
				// @ts-ignore
				line: target.dataset.line,
				// @ts-ignore
				column: target.dataset.column,
				// @ts-ignore
				length: target.dataset.length,
			});
		});
	});

	document.querySelectorAll('.submit').forEach(element => {
		element.addEventListener('click', () => {
			vscode.postMessage({
				command: 'submit',
				severitySelection:selectSeverity,
				stateSelection:selectState
			});
		});
	});

	document.getElementById('select_severity').addEventListener('change', (e) => {
		console.log("changed",e.target.value);
		selectSeverity=e.target.value;
		});

	document.getElementById('select_state').addEventListener('change', (e) => {
		console.log("changed",e.target.value);
		selectState=e.target.value;
		});
}());