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


	document.querySelector('.ast-project').addEventListener('change', () => {
		const projectID = document.getElementById("projectID").value;
		const scanID = document.getElementById("scanID");
		const scans = document.getElementById("scans");
		const scanIDOptions = scans.options;
		scanIDOptions.length = 0;
		const defaultOption = document.createElement("option");
		defaultOption.text = "Loading scans";
		defaultOption.value = "";
		defaultOption.disabled = true;
		defaultOption.selected = true;
		scans.appendChild(defaultOption);
		scans.disabled = true;
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

	function loadOption(text, value, disabled, selected) {
		const option = document.createElement("option");
		option.text = text;
		option.value = value;
		option.disabled = disabled;
		option.selected = selected;
		return option;
	}

	function disableSelection(disable) {
		const projectID = document.getElementById("projectID");
		const scans = document.getElementById("scans");
		const scanID = document.getElementById("scanID");
		projectID.disabled = disable;
		scans.disabled = disable;
		scanID.disabled = disable;
	}

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
					// if the obtained scan list is not empty, populate scan list dropdown
					selectElement.disabled = false;
					selectElement.add(loadOption('Select a scan', '', true, true));
					for (var scan in scans) {
						const scanDate = scans[scan].CreatedAt.split("T")[0] + " " + scans[scan].CreatedAt.split("T")[1].split(".")[0];
						const option = loadOption(scanDate, scans[scan].ID, false, false);
						selectElement.appendChild(option);
						if (workspaceScan === scanDate) {
							option.selected = true;
						}
					}
				}
				else {
					selectElement.add(loadOption("No scans found for project", "", true, true));
					selectElement.disabled = true;
					const scanID = document.getElementById("scanID");
					scanID.value = '';
				}
				break;
			case 'disableSelection':
				disableSelection(true);
				break;
			case 'enableSelection':
				disableSelection(false);
				break;
			case 'loadedscan':
				const selectedProjectID = message.selectedProjectID;
				const projectElementSelected = document.getElementById("projectID");
				const scanElementSelected = document.getElementById("scanID");
				const scansSelected = document.getElementById("scans");
				let projectSelected = false;
				let scanSelected = false;
				Array.from(document.getElementById("projectID").options).forEach(function (option_element) {
					if (option_element.value === selectedProjectID) {
						option_element.selected = true;
						projectSelected = true;
					}
				});
				if (!projectSelected) {
					projectElementSelected.appendChild(loadOption("Selected project not in list", "", true, true));
				}
				const scanItem = message.scanList.filter(scan => scan.ID === message.selectedScanID);
				if (scanItem.length > 0) {
					Array.from(document.getElementById("scans").options).forEach(function (option_element) {
						if (option_element.value === scanElementSelected.value) {
							option_element.selected = true;
							scanSelected = true;
						}
					});
				}
				if (!scanSelected) {
					scansSelected.appendChild(loadOption("Selected scan not in list", "", true, true));
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
					let workspaceProject = projects.filter(project => {
						return workspaceElement !== undefined ? workspaceElement.includes(project.Name) : '';
					});
					if (workspaceProject.length > 0) {
						projectElement.appendChild(loadOption(workspaceProject[0].Name, workspaceProject[0].ID, false, true));
						projects = projects.filter(project => { return project.Name !== workspaceProject[0].Name; });
						vscode.postMessage(
							{
								command: 'projectSelected',
								projectID: workspaceProject[0].ID
							});
					}

					else if (existingProjectID !== '' && existingProjectName.length > 0) {
						projectElement.appendChild(loadOption(existingProjectName[0].Name, existingProjectID, false, true));
						projects = projects.filter(project => { return project.Name !== existingProjectName[0].Name; });
						vscode.postMessage(
							{
								command: 'projectSelected',
								projectID: existingProjectID
							});
					}
					else {
						projectElement.appendChild(loadOption("Select a project", "", true, true));
						const scanID = document.getElementById("scanID");
						scanID.value = '';
					}

					for (var project in projects) {
						projectElement.appendChild(loadOption(projects[project].Name, projects[project].ID, false, false));
					}
				}
				break;
		}
	});
}());