//@ts-check
// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
	var selectSeverity="";
	var selectState="";
	var comment="";
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
				stateSelection:selectState,
				comment:comment
			});
		});
	});

	document.getElementById('select_severity').addEventListener('change', (e) => {
		// @ts-ignore
		selectSeverity=e.target.value;
		});

	document.getElementById('select_state').addEventListener('change', (e) => {
		// @ts-ignore
		selectState=e.target.value;
		});
	
	// Trigered in order to load the changes
	document.getElementById('tab3').addEventListener('click', (e) => {
		vscode.postMessage({
			command: 'changes'
		});
	});
	
	// Display the changes once loaded
	window.addEventListener('message', event => {
		const message = event.data; 
		switch (message.command) {
			case 'changesLoaded':
				const tab = document.getElementById('tab3');
				tab.click();
		}
	});

	// Display the comment text area
	document.getElementById('show_comment').addEventListener('click', (e) => {
		let commentBox = document.getElementById('comment_box');
		let commentLabel = document.getElementById('comment_label');
		if(commentBox.style.display==='none'){
			commentBox.style.display = 'flex';
			commentLabel.innerHTML = 'Hide comment &#8613';
		}
		else{
			commentBox.style.display = 'none';
			commentLabel.innerHTML = 'Show comment &#8615';
		}
	});
	
	// Get the content from the comment box
	document.getElementById('comment_box').addEventListener('change', (e) => {
		// @ts-ignore
		comment = e.target.value;
	});
}());