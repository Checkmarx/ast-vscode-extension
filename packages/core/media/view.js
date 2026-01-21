//@ts-check
// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
	var selectSeverity = "";
	var selectState = "";
	var comment = "";
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
				severitySelection: selectSeverity,
				stateSelection: selectState,
				comment: comment
			});
		});
	});

	// Activated when clicked in AI Security Champion
	document.querySelectorAll('.title_gpt').forEach(element => {
		element.addEventListener('click', () => {
			vscode.postMessage({
				command: 'gpt',
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
				link: e.target.id
			});
		});
	});

	// Apply the sca fix for a vulnerability
	document.querySelectorAll('.remediation-icon').forEach(element => {
		element.addEventListener('click', (e) => {
			// @ts-ignore
			var target = e.target;
			console.log(target);
			vscode.postMessage({
				command: 'scaFix',
				// @ts-ignore
				package: target.dataset.package,
				// @ts-ignore
				file: target.dataset.file,
				// @ts-ignore
				version: target.dataset.version
			});
		});
	});

	// Apply the sca fix for a vulnerability
	document.querySelectorAll('.remediation-version').forEach(element => {
		element.addEventListener('click', (e) => {
			// @ts-ignore
			var target = e.target;
			console.log(target);
			vscode.postMessage({
				command: 'scaFix',
				// @ts-ignore
				package: target.dataset.package,
				// @ts-ignore
				file: target.dataset.file,
				// @ts-ignore
				version: target.dataset.version
			});
		});
	});

	// Apply the sca fix for a vulnerability
	document.querySelectorAll('.upgrade-small-icon').forEach(element => {
		element.addEventListener('click', (e) => {
			// @ts-ignore
			var target = e.target;
			console.log(target);
			vscode.postMessage({
				command: 'scaFix',
				// @ts-ignore
				package: target.dataset.package,
				// @ts-ignore
				file: target.dataset.file,
				// @ts-ignore
				version: target.dataset.version
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
				link: e.target.id
			});
		});
	});

	// Activated when clicked in package next
	document.querySelectorAll('.package-next').forEach(element => {
		element.addEventListener('click', (e) => {
			// @ts-ignore
			var target = e.target;
			// @ts-ignore
			var current = target.dataset.current;
			// @ts-ignore
			var total = target.dataset.total;
			var next = parseInt(current, 10) + 1;
			if (next + 1 > parseInt(total, 10)) {
				// @ts-ignore
				e.target.disabled = true;
			}
			// Change the displayed tables for packages
			let currentPage = document.getElementById('package-table-' + current);
			currentPage.style.display = 'none';
			let nextPage = document.getElementById('package-table-' + next);
			nextPage.style.display = '';
			// Change the displayed tables for locations
			let currentPageLocations = document.getElementById('locations-table-' + current);
			currentPageLocations.style.display = 'none';
			let nextPageLocations = document.getElementById('locations-table-' + next);
			nextPageLocations.style.display = '';
			// Update in the next button
			// @ts-ignore
			target.dataset.current = next;
			let backButton = document.getElementById('package-back');
			// @ts-ignore
			backButton.disabled = false;
			// @ts-ignore
			backButton.dataset.current = next;
			// Update in the back button
			// @ts-ignore
			target.dataset.current = next;
			// Update the counter
			let counter = document.getElementById('package-counter');
			counter.innerHTML = "<p>" + (parseInt(current, 10) + 1) + "/" + total + "</p>";
		});
	});

	// Activated when clicked in package back
	document.querySelectorAll('.package-back').forEach(element => {
		element.addEventListener('click', (e) => {
			// @ts-ignore
			var target = e.target;
			// @ts-ignore
			var current = target.dataset.current;
			// @ts-ignore
			var total = target.dataset.total;
			var next = parseInt(current, 10) - 1;
			// @ts-ignore
			let nextButton = document.getElementById('package-next');
			// @ts-ignore
			nextButton.disabled = false;
			if (parseInt(current, 10) - 2 === 0) {
				// @ts-ignore
				e.target.disabled = true;
			}
			// Change the displayed tables for packages
			let currentPage = document.getElementById('package-table-' + current);
			currentPage.style.display = 'none';
			let nextPage = document.getElementById('package-table-' + next);
			nextPage.style.display = '';
			// Change the displayed tables for locations
			let currentPageLocation = document.getElementById('locations-table-' + current);
			currentPageLocation.style.display = 'none';
			let nextPageLocation = document.getElementById('locations-table-' + next);
			nextPageLocation.style.display = '';
			// Update in the back button
			// @ts-ignore
			target.dataset.current = next;
			// @ts-ignore
			nextButton.dataset.current = next;
			// Update in the back button
			// @ts-ignore
			target.dataset.current = next;
			// Update the counter
			let counter = document.getElementById('package-counter');
			counter.innerHTML = "<p>" + (parseInt(current, 10) - 1) + "/" + total + "</p>";
		});
	});

	let severityElement = document.getElementById('select_severity');
	if (severityElement) {
		severityElement.addEventListener('change', (e) => {
			// @ts-ignore
			selectSeverity = e.target.value;
		});
	}

	let selectElement = document.getElementById('select_state');
	if (selectElement) {
		selectElement.addEventListener('change', (e) => {
			// @ts-ignore
			selectState = e.target.value;
		});
	}

	let commentElement = document.getElementById('comment_box');
	if (commentElement) {
		document.getElementById('comment_box').addEventListener('change', (e) => {
			// @ts-ignore
			comment = e.target.value;
		});
	}


	// Display the changes once loaded
	window.addEventListener('message', event => {
		const message = event.data;
		switch (message.command) {
			case 'updateThemeIcon': {
				// Update the CodeBashing icon for theme change
				const codeBashingIcon = document.getElementById('cx_codebashing');
				if (codeBashingIcon && message.iconUri) {
					codeBashingIcon.setAttribute('src', message.iconUri);
					// Also update the global variable for future use
					window.codeBashingIconUri = message.iconUri;
				}
				break;
			}
			case 'loadChanges': {
				let changes = message.changes;
				for (const change of changes) {
					if (!change) {continue;}

					const setVal = (selId, id) => {
						let opt = document.querySelector(`#${selId} option[value="${id}"]`);
						if (!opt) {
							opt = document.querySelector(`#${selId} option[id="${id}"]`);
						}
						if (opt) {document.getElementById(selId).value = opt.value || opt.textContent;}
					};

					setVal('select_state', change.State);
					if(change.Severity){
						setVal('select_severity', change.Severity);
					}
					break;
				}

				let loaderContainer = document.getElementById('history-container-loader');
				if (loaderContainer) {
					loaderContainer.style.display = 'none';
					loaderContainer.innerHTML = infoChangeContainer(changes);
					loaderContainer.style.display = 'block';
					loaderContainer.style.padding = '0.4em';
				}
				break;
			}
			case 'loader': {
				// html do loader
				let loaderContainer = document.getElementById('history-container-loader');
				if (loaderContainer) {
					loaderContainer.innerHTML = loader();
					loaderContainer.style.display = 'block';
				}
				break;
			}
			case 'loadLearnMore': {
				let learn = message.learn;
				let learnLoaderContainer = document.getElementById('learn-container-loader');
				learnLoaderContainer.style.display = 'none';
				learnLoaderContainer.innerHTML = infoLearnContainer(learn, message.result);
				learnLoaderContainer.style.display = 'block';
				let codeLoaderContainer = document.getElementById('tab-code');
				codeLoaderContainer.style.display = 'none';
				codeLoaderContainer.innerHTML = infoCodeContainer(learn);
				codeLoaderContainer.style.display = 'block';
				registerCodebashingEventListener();
				break;
			}
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


	function registerCodebashingEventListener() {
		let codebashingElement = document.getElementById('cx_codebashing');
		if (codebashingElement) {
			codebashingElement.addEventListener('click', () => {
				// @ts-ignore
				vscode.postMessage({
					command: 'codebashing',
				});
			});
		}
	}

	// Container arround the changes
	function infoChangeContainer(changes) {
		let html = "<body>";
		if (changes.length > 0) {
			for (let change of changes) {
				html += userCardInfo(change.CreatedBy, new Date(change.CreatedAt).toLocaleString(), infoChanges(change));
			}
		}
		else {
			html +=
				`
				<div class="history-container">
					<p>
						No changes to display. 
					</p>
				</div>`;
		}
		html += "</body>";
		return html;
	}

	// Remediation examples content
	function infoCodeContainer(learnArray) {
		let html = '<div>';
		if (learnArray.length > 0) {
			for (let learn of learnArray) {
				for (let code of learn.samples) {
					let learnSectionDiv = document.createElement('div');
					learnSectionDiv.setAttribute('class', 'learn-section');
					let codeTitlePara = document.createElement('p');
					codeTitlePara.textContent = '' + code.title + ' using ' + code.progLanguage;
					let preCode = document.createElement('pre');
					preCode.setAttribute('class', 'pre-code');
					let codeElement = document.createElement('code');
					codeElement.textContent = code.code;
					preCode.appendChild(codeElement);
					learnSectionDiv.appendChild(codeTitlePara);
					learnSectionDiv.appendChild(preCode);
					html += learnSectionDiv.outerHTML;
				}
			}
		}
		else {
			html +=
				`
				<p>
					No remediation examples available to display. 
				</p>
				`;
		}
		html += "</div>";
		return html;
	}

	// Description content
	function infoLearnContainer(descriptionArray, result) {
		let html = "<div>";
		if (descriptionArray.length > 0) {
			for (let description of descriptionArray) {
				html += codeBashingSection(result);
				html += riskSection(description.risk);
				html += causeSection(description.cause);
				html += recommendationSection(description.generalRecommendations);
				// Dynamically add CWE link if available
            if (result.cweId) {
                html += `
                    <div class="learn-section">
                        <p>
                            <strong>Learn more about this vulnerability:</strong>
                            <a href="https://cwe.mitre.org/data/definitions/${result.cweId}.html" target="_blank" rel="noopener noreferrer">
                                CWE-${result.cweId}
                            </a>
                        </p>
                    </div>
                `;
			}
		}
	} else {
			html +=
				`
				<div class="history-container">
					<p>
						No information available to display. 
					</p>
				</div>`;
		}
		html += "</div>";
		return html;
	}

	function codeBashingSection(result) {
		let codeBashingSection = "";
		if (result.sastNodes.length > 0) {
			let headerItemCodebashingDiv = document.createElement('div');
			headerItemCodebashingDiv.setAttribute('id', 'cx_header_codebashing');
			headerItemCodebashingDiv.style.marginBottom = '20px';
			let codebashingLinkIcon = document.createElement('span');
            codebashingLinkIcon.setAttribute('class', 'codebashing-link');
            codebashingLinkIcon.textContent = 'Learn more at ';
            let codeBashingIcon = document.createElement('img');
            let iconSrc = window.codeBashingIconUri;
            codeBashingIcon.setAttribute('src', iconSrc);
            codeBashingIcon.setAttribute('id', 'cx_codebashing');
            codeBashingIcon.setAttribute('title', "Learn more about " + result.queryName + " using Checkmarx's eLearning platform");
            codeBashingIcon.setAttribute('alt', 'CodeBashing');
            codeBashingIcon.style.cssText = 'height:40px;width:auto;cursor:pointer;vertical-align:middle;margin-left:6px;';
            codebashingLinkIcon.appendChild(codeBashingIcon);
			headerItemCodebashingDiv.appendChild(codebashingLinkIcon);
			return headerItemCodebashingDiv.outerHTML;
		}
		return codeBashingSection;
	}


	function riskSection(risk) {
		let learnSectionDiv = document.createElement('div');
		learnSectionDiv.setAttribute('class', 'learn-section');
		let learnHeaderPara = document.createElement('p');
		learnHeaderPara.setAttribute('class', 'learn-header');
		learnHeaderPara.textContent = 'Risk';
		let riskPara = document.createElement('p');
		riskPara.innerHTML = risk;
		learnSectionDiv.appendChild(learnHeaderPara);
		learnSectionDiv.appendChild(riskPara);
		return learnSectionDiv.outerHTML;

	}

	function causeSection(cause) {
		let learnSectionDiv = document.createElement('div');
		learnSectionDiv.setAttribute('class', 'learn-section');
		let learnHeaderPara = document.createElement('p');
		learnHeaderPara.setAttribute('class', 'learn-header');
		learnHeaderPara.textContent = 'Cause';
		let causePara = document.createElement('p');
		causePara.innerHTML = cause;
		learnSectionDiv.appendChild(learnHeaderPara);
		learnSectionDiv.appendChild(causePara);
		return learnSectionDiv.outerHTML;
	}

	function recommendationSection(recommendations) {
		let learnSectionDiv = document.createElement('div');
		learnSectionDiv.setAttribute('class', 'learn-section');
		let learnHeaderPara = document.createElement('p');
		learnHeaderPara.setAttribute('class', 'learn-header');
		learnHeaderPara.textContent = 'General Recommendations';
		let recommendationsSpan = document.createElement('span');
		recommendationsSpan.setAttribute('class', 'code-sample');
		recommendationsSpan.innerHTML = recommendations;
		learnSectionDiv.appendChild(learnHeaderPara);
		learnSectionDiv.appendChild(recommendationsSpan);
		return learnSectionDiv.outerHTML;
	}


	// Individual changes
	function infoChanges(change) {
		let infoDiv = document.createElement("div");
		let severityPara = document.createElement("p");
		let severityClass = change.Severity?.length > 0 ? ("select-" + change.Severity.toLowerCase()) : "";
		severityPara.setAttribute('class', severityClass);
		var severity = change.Severity === undefined ? "" : (change.Severity?.length > 0 ? change.Severity : "No changes in severity.");
		severityPara.textContent = severity;
		let statePara = document.createElement("p");
		statePara.setAttribute('class', 'state');
		var state = change.State.length > 0 ? change.State.replaceAll("_", " ") : "No changes in state.";
		const formattedState = state.replace(/([a-z])([A-Z])/g, "$1 $2");
		statePara.textContent = formattedState;
		infoDiv.appendChild(severityPara);
		infoDiv.appendChild(statePara);
		if (change.Comment.length > 0) {
			let commentPara = document.createElement("p");
			commentPara.setAttribute('class', 'comment');
			commentPara.textContent = change.Comment;
			infoDiv.appendChild(commentPara);
		}
		return infoDiv.outerHTML;
	}

	// Generic card for changes
	function userCardInfo(username, date, info) {
		let historyContainerDiv = document.createElement('div');
		historyContainerDiv.setAttribute('class', 'history-container');
		let historyHeaderDiv = document.createElement('div');
		historyHeaderDiv.setAttribute('class', 'history-header');
		let userNameDiv = document.createElement('div');
		userNameDiv.setAttribute('class', 'username');
		userNameDiv.textContent = username;
		let dateDiv = document.createElement('div');
		dateDiv.setAttribute('class', 'date');
		dateDiv.textContent = date;
		let textContentDiv = document.createElement('div');
		textContentDiv.setAttribute('class', 'text-content');
		textContentDiv.innerHTML = info;
		historyHeaderDiv.appendChild(userNameDiv);
		historyHeaderDiv.appendChild(dateDiv);
		historyContainerDiv.appendChild(historyHeaderDiv);
		historyContainerDiv.appendChild(textContentDiv);
		return historyContainerDiv.outerHTML;
	}

	function loader() {
		let historyContainerLoaderDiv = document.createElement('div');
		historyContainerLoaderDiv.setAttribute('id', 'history-container-loader');
		historyContainerLoaderDiv.setAttribute('class', 'center');
		let historyContainerLoaderPara = document.createElement('p');
		historyContainerLoaderPara.setAttribute('class', 'history-container-loader');
		historyContainerLoaderPara.textContent = 'Loading changes';
		let loaderDiv = document.createElement('div');
		loaderDiv.setAttribute('class', 'loader');
		historyContainerLoaderDiv.appendChild(historyContainerLoaderPara);
		historyContainerLoaderDiv.appendChild(loaderDiv);
		return historyContainerLoaderDiv.outerHTML;
	}

	function updateDisplay(id, display) {
		let element = document.getElementById(id);
		element.style.display = display;
	}

})();