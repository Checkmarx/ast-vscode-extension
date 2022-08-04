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

	// Open external link for more info
	document.querySelectorAll('.remediation-links-text').forEach(element => {
		element.addEventListener('click', (e) => {
			// @ts-ignore
			vscode.postMessage({
				command: 'references',
				// @ts-ignore
				link:e.target.id
			});
		});
	});

	// Open external link for more info
	document.querySelectorAll('.remediation-icon').forEach(element => {
		element.addEventListener('click', (e) => {
			// @ts-ignore
			var target = e.target;
			console.log(target);
			vscode.postMessage({
				command: 'scaFix',
				// @ts-ignore
				package:target.dataset.package,
				// @ts-ignore
				file:target.dataset.file,
				// @ts-ignore
				version:target.dataset.version
			});
		});
	});
	
	// Open external link for referencess
	document.querySelectorAll('.references').forEach(element => {
		element.addEventListener('click', (e) => {
			// @ts-ignore
			vscode.postMessage({
				command: 'references',
				// @ts-ignore
				link:e.target.id
			});
		});
	});
	
	// Activated when clicked in package next
	document.querySelectorAll('.package-next').forEach(element => {
		element.addEventListener('click', (e) => {
			// @ts-ignore
			var target = e.target;
			// @ts-ignore
			var current =  target.dataset.current;
			// @ts-ignore
			var total = target.dataset.total;
			var next = parseInt(current, 10)+1;
			if(next+1 > parseInt(total, 10)){
				// @ts-ignore
				e.target.disabled=true;
			}
			// Change the displayed tables for packages
			let currentPage = document.getElementById('package-table-'+current);
			currentPage.style.display = 'none';
			let nextPage = document.getElementById('package-table-'+next);
			nextPage.style.display = '';
			// Change the displayed tables for locations
			let currentPageLocations = document.getElementById('locations-table-'+current);
			currentPageLocations.style.display = 'none';
			let nextPageLocations = document.getElementById('locations-table-'+next);
			nextPageLocations.style.display = '';
			// Update in the next button
			// @ts-ignore
			target.dataset.current = next;
			let backButton = document.getElementById('package-back');
			// @ts-ignore
			backButton.disabled=false;
			// @ts-ignore
			backButton.dataset.current=next;
			// Update in the back button
			// @ts-ignore
			target.dataset.current = next;
			// Update the counter
			let counter = document.getElementById('package-counter');
			counter.innerHTML = "<p>"+(parseInt(current, 10)+1)+"/"+total+"</p>";
		});
	});
	
	// Activated when clicked in package back
	document.querySelectorAll('.package-back').forEach(element => {
		element.addEventListener('click', (e) => {
			// @ts-ignore
			var target = e.target;
			// @ts-ignore
			var current =  target.dataset.current;
			// @ts-ignore
			var total = target.dataset.total;
			var next = parseInt(current, 10)-1;
			// @ts-ignore
			let nextButton = document.getElementById('package-next');
			// @ts-ignore
			nextButton.disabled=false;
			if(parseInt(current, 10)-2 === 0){
				// @ts-ignore
				e.target.disabled=true;
			}
			// Change the displayed tables for packages
			let currentPage = document.getElementById('package-table-'+current);
			currentPage.style.display = 'none';
			let nextPage = document.getElementById('package-table-'+next);
			nextPage.style.display = '';
			// Change the displayed tables for locations
			let currentPageLocation = document.getElementById('locations-table-'+current);
			currentPageLocation.style.display = 'none';
			let nextPageLocation = document.getElementById('locations-table-'+next);
			nextPageLocation.style.display = '';
			// Update in the back button
			// @ts-ignore
			target.dataset.current = next;
			// @ts-ignore
			nextButton.dataset.current=next;
			// Update in the back button
			// @ts-ignore
			target.dataset.current = next;
			// Update the counter
			let counter = document.getElementById('package-counter');
			counter.innerHTML = "<p>"+(parseInt(current, 10)-1)+"/"+total+"</p>";
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
				break;
			// case 'loadBfl':
			// 	console.log("loadedBFl");
			// 	let index =  message.index.index;
			// 	// Case there is a best fix location
			// 	if(index>=0){
			// 		updateDisplay('bfl-container-'+index,'block');
			// 		// Hide loading message
			// 		updateDisplay('bfl-tip-loading','none');
			// 		updateDisplay('loader','none');
			// 		// Show tooltip message
			// 		updateDisplay('bfl-tip-loaded','block');
			// 	}
			// 	// Case there is not best fix location
			// 	else{
			// 		// Hide the loading
			// 		updateDisplay('bfl-tip-loading','none');
			// 		updateDisplay('loader','none');
			// 	}
			// 	break;
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
					:""
				}
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

	function updateDisplay(id,display){
		let element = document.getElementById(id);
		element.style.display = display;
	}
}());