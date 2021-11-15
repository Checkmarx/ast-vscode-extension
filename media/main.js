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
	// document.querySelector('.ast-settings').addEventListener('click', () => {
	// 	vscode.postMessage({
	// 		command: 'settings'
	// 	});
	// });

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

	// document.querySelector('.ast-clear').addEventListener('click', () => {
	// 	const scanID = document.getElementById("scanID");
	// 	scanID.value = '';
	// 	vscode.postMessage({
	// 		command: 'clear'
	// 	});
	// });

	window.addEventListener('message', event => {

		const message = event.data; // The JSON data our extension sent

		switch (message.instruction) {
			case 'clear ID':
				const scanID = document.getElementById("scanID");
				scanID.value = '';
				Array.from(document.getElementById("scans").options).forEach(function(option_element) {
					if(option_element.text ===	'Select a scan') {
						option_element.selected = true;
					}
				});
				break;
			case 'loadscanlist':
				const scans = message.scans;
				const selectElement = document.getElementById("scans");
				selectElement.options.length = 0;
				if (scans.length > 0) {
					selectElement.disabled = false;
					const defaultOption = document.createElement("option");
					defaultOption.text = "Select a scan";
					defaultOption.value = "";
					defaultOption.disabled = true;
					defaultOption.selected = true;
					selectElement.add(defaultOption);
					for (var scan in scans) {
						//append options
						const option = document.createElement("option");
						//const optionText = document.createTextNode(scans.scans[scan].name);
						const optionText = document.createTextNode(scans[scan].CreatedAt);
						option.appendChild(optionText);
						//option.setAttribute("value", scans.scans[scan].id);
						option.setAttribute("value", scans[scan].ID);
						selectElement.appendChild(option);
					}
				}
				else {
					const defaultOption = document.createElement("option");
					defaultOption.text = "No scans found for project";
					defaultOption.value = "";
					defaultOption.disabled = true;
					defaultOption.selected = true;
					selectElement.add(defaultOption);
					selectElement.disabled = true;
					const scanID = document.getElementById("scanID");
					scanID.value = '';
				}
				break;
			case 'loadedscan':
				const selectedProjectID = message.selectedProjectID;
				const projectElementSelected = document.getElementById("projectID");
				const scanElementSelected = document.getElementById("scanID");
				const scansSelected = document.getElementById("scans");
				let projectSelected = false;
				let scanSelected = false; 
				//const projectName = message.projectList.find(project => project.ID === selectedProjectID).Name;
					Array.from(document.getElementById("projectID").options).forEach(function(option_element) {
						if(option_element.value ===	selectedProjectID) {
							option_element.selected = true;
							projectSelected = true;
						}
					});				
				if(!projectSelected){
				const projectIDOption = document.createElement("option");
				projectIDOption.text = "Selected project not in list";
				projectIDOption.value = "";
				projectIDOption.disabled = true;
				projectIDOption.selected = true;
				projectElementSelected.appendChild(projectIDOption);
				}
				console.log("scanList: " + message.scanList);
				const scanItem = message.scanList.filter(scan =>	scan.ID === message.selectedScanID);
				console.log(scanItem);
				if(scanItem.length > 0) {
					const scanName = scanItem[0].Name;
					const scanID = scanItem[0].ID;
					scanElementSelected.value = scanID;
					scanElementSelected.disabled = false;
					scanElementSelected.selected = true;
					scanSelected = true;
				}

				// Array.from(document.getElementById("scans").options).forEach(function(option_element) {
				// 	console.log("scan option: " + option_element.value + " selectd: " + scanElementSelected.value);
				// 	if(option_element.value ===	scanElementSelected.value) {
				// 		option_element.selected = true;
				// 		scanSelected = true;
				// 	}
				// });
				if(!scanSelected){
					const scanIDOption = document.createElement("option");
					scanIDOption.text = "Selected scan not in list";
					scanIDOption.value = "";
					scanIDOption.selected = true;
					scanIDOption.disabled = true;
					scansSelected.appendChild(scanIDOption);
					}
				break;

			case 'loadprojectlist':
				let projects = message.projects;
				const workspaceElement = message.workspaceName;
				const existingProjectID = message.existingProjectID;
				const projectElement = document.getElementById("projectID");
				if (projects.length > 0) {
					projectElement.disabled = false;
					const defaultOption = document.createElement("option");
					let workspaceProject = projects.filter(project => {
						return workspaceElement !== undefined ? workspaceElement.includes(project.Name) : '';
					});
					if (workspaceProject.length > 0) {
						const projectoptionText = document.createTextNode(workspaceProject[0].Name);
						defaultOption.appendChild(projectoptionText);
						defaultOption.setAttribute("value", workspaceProject[0].ID);
						defaultOption.selected = true;
						projectElement.appendChild(defaultOption);
						console.log(projects);
						projects = projects.filter(project => { return project.Name !== workspaceProject[0].Name; });
						vscode.postMessage(
							{
							command: 'projectSelected',
							projectID: workspaceProject[0].ID,
						});
					}

					else if(existingProjectID !== '') {
						const projectName = projects.filter(project => project.ID === existingProjectID);
						defaultOption.text = projectName[0].Name;
						defaultOption.value = existingProjectID;
						defaultOption.disabled = false;
						defaultOption.selected = true;
						projectElement.appendChild(defaultOption);
						vscode.postMessage(
							{
							command: 'projectSelected',
							projectID: existingProjectID,
						});
					}
					else {
						defaultOption.text = "Select a project";
						defaultOption.value = "";
						defaultOption.disabled = true;
						defaultOption.selected = true;
						projectElement.appendChild(defaultOption);
					}

					for (var project in projects) {
						//append options
						const projectoption = document.createElement("option");
						//const optionText = document.createTextNode(scans.scans[scan].name);
						const projectoptionText = document.createTextNode(projects[project].Name);
						projectoption.appendChild(projectoptionText);
						//option.setAttribute("value", scans.scans[scan].id);
						projectoption.setAttribute("value", projects[project].ID);
						projectElement.appendChild(projectoption);
					}
				}
				break;


		}
	});
}());