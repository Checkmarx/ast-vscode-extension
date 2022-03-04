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

	// Activated when clicked in triage update
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
	
	
	// Get the content from the comment box
	document.getElementById('comment_box').addEventListener('change', (e) => {
		// @ts-ignore
		comment = e.target.value;
	});
	
	document.getElementById('cx_codebashing').addEventListener('click', () => {
		// @ts-ignore
		vscode.postMessage({
			command: 'codebashing',
		});
	});

	// Display the changes once loaded
	window.addEventListener('message', event => {
		const message = event.data; 
		switch (message.command) {
			case 'loadChanges':
				let changes =  message.changes;
				let loaderContainer = document.getElementById('history-container-loader');
				loaderContainer.style.display = 'none';
				loaderContainer.innerHTML = infoChangeContainer(changes);
				loaderContainer.style.display = 'block';
				break;
			case 'loader':
				// html do loader
				loaderContainer = document.getElementById('history-container-loader');
				loaderContainer.innerHTML = loader();
				loaderContainer.style.display = 'block';
		}
	});

	// Container arround the changes
	function infoChangeContainer(changes){
		let html = "<body>";
		if(changes.length>0){
			for (let change of changes) {
				html+=userCardInfo(change.CreatedBy,new Date(change.CreatedAt).toLocaleString(),infoChanges(change));
			}
		}
		else{
			html+=
				`
				<div class="history-container">
					<p>
						No changes to display. 
					</p>
				</div>`;
		}
		html+="</body>";
		return html;
	}

	// Individual changes
	function infoChanges(change){		
		return(
			`<p class="${change.Severity.length>0?"select-"+change.Severity.toLowerCase():""}">
				${change.Severity.length>0?change.Severity:"No changes in severity."}
			</p>
			<p class="state">
				${change.State.length>0?change.State.replaceAll("_"," "):"No changes in state."}
			</p>
			
				${change.Comment.length>0?
					`<p class="comment">
						${change.Comment}
					</p>`
					:""}
			`
		);
	}
	
	// Generic card for changes
	function userCardInfo(username,date,info){
		return(
			`<div class="history-container">
				<div class="history-header">
				<div class="username">
					${username}
				</div>
				<div class="date">
					${date}
				</div>
				</div>
				<div class="text-content">
					${info}
				</div>
			</div>`
		);
	}
	
	function loader(){
		return(
			`
			<div id=\"history-container-loader\">
				<center>
					<p class=\"history-container-loader\">
						Loading changes
					</p>
					<div class=\"loader\">
					</div>
				</center>
			</div>
			`
		);
	}
}());