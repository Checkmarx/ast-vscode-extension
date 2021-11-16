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
		const scanID = document.getElementById("scanID");
		scanID.value = '';
		vscode.postMessage({
			command: 'projectSelected',
			projectID: projectID,
		});
	});

	document.querySelector('.ast-scans').addEventListener('change', () => {
		const selectedScanID = document.getElementById("scans").value;
		const selectedScanName = document.getElementById("scans").options[document.getElementById("scans").selectedIndex].text;
		const scanID = document.getElementById("scanID");
		scanID.value = selectedScanID;
		vscode.postMessage({
			command: 'scanSelected',
			selectedScanID: selectedScanID,
			selectedScanName: selectedScanName
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
				Array.from(document.getElementById("scans").options).forEach(function (option_element) {
					if (option_element.text === 'Select a scan') {
						option_element.selected = true;
					}
				});
				break;
			case 'loadscanlist':
				const scans = message.scans;
				const workspaceScan = message.workspaceScan;
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
						const scanDate = scans[scan].CreatedAt.split("T")[0] + " " + scans[scan].CreatedAt.split("T")[1].split(".")[0];
						const optionText = document.createTextNode(scanDate);
						option.appendChild(optionText);
						//option.setAttribute("value", scans.scans[scan].id);
						option.setAttribute("value", scans[scan].ID);
						selectElement.appendChild(option);
						if (workspaceScan === scanDate) {
							option.selected = true;
						}
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
			case 'disableSelection':
				const disableprojectID = document.getElementById("projectID");
				const disableScans = document.getElementById("scans");
				const disableScanID = document.getElementById("scanID");
				disableprojectID.disabled = true;
				disableScans.disabled = true;
				disableScanID.disabled = true;
				break;
			case 'enableSelection':
				const enableprojectID = document.getElementById("projectID");
				const enableScans = document.getElementById("scans");
				const enableScanID = document.getElementById("scanID");
				enableprojectID.disabled = false;
				enableScans.disabled = false;
				enableScanID.disabled = false;
				break;
			case 'loadedscan':
				const selectedProjectID = message.selectedProjectID;
				const projectElementSelected = document.getElementById("projectID");
				const scanElementSelected = document.getElementById("scanID");
				const scansSelected = document.getElementById("scans");
				let projectSelected = false;
				let scanSelected = false;
				//const projectName = message.projectList.find(project => project.ID === selectedProjectID).Name;
				Array.from(document.getElementById("projectID").options).forEach(function (option_element) {
					if (option_element.value === selectedProjectID) {
						option_element.selected = true;
						projectSelected = true;
						// vscode.postMessage(
						// 	{
						// 	command: 'projectSelected',
						// 	projectID: selectedProjectID
						// });
					}
				});
				if (!projectSelected) {
					const projectIDOption = document.createElement("option");
					projectIDOption.text = "Selected project not in list";
					projectIDOption.value = "";
					projectIDOption.disabled = true;
					projectIDOption.selected = true;
					projectElementSelected.appendChild(projectIDOption);
				}
				console.log("scanList: " + message.scanList);
				const scanItem = message.scanList.filter(scan => scan.ID === message.selectedScanID);
				console.log(scanItem);
				if (scanItem.length > 0) {
					// const scanName = scanItem[0].Name;
					// const scanID = scanItem[0].ID;
					// scanElementSelected.value = scanID;
					// scanElementSelected.disabled = false;
					// scanElementSelected.selected = true;
					// scanSelected = true;
					Array.from(document.getElementById("scans").options).forEach(function (option_element) {
						console.log("scan option: " + option_element.value + " selectd: " + scanElementSelected.value);
						if (option_element.value === scanElementSelected.value) {
							option_element.selected = true;
							scanSelected = true;
						}
					});
				}


				if (!scanSelected) {
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
				const existingProjectName = projects.filter(project => project.ID === existingProjectID);
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
								projectID: workspaceProject[0].ID
							});
					}

					else if (existingProjectID !== '' && existingProjectName.length > 0) {
						console.log("workspace project name " + existingProjectName[0].Name);
						const projectIndex = projects.findIndex(project => project.ID === existingProjectID);
						console.log("workspace project index " + projectIndex);
						const projectoptionText = document.createTextNode(existingProjectName[0].Name);
						defaultOption.appendChild(projectoptionText);
						defaultOption.setAttribute("value", existingProjectID);
						defaultOption.selected = true;
						projectElement.appendChild(defaultOption);
						projects = projects.filter(project => { return project.Name !== existingProjectName[0].Name; });
						vscode.postMessage(
							{
								command: 'projectSelected',
								projectID: existingProjectID
							});
					}
					else {
						defaultOption.text = "Select a project";
						defaultOption.value = "";
						defaultOption.disabled = true;
						defaultOption.selected = true;
						projectElement.appendChild(defaultOption);
						const scanID = document.getElementById("scanID");
						scanID.value = '';
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