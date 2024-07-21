import { ActivityBar, ViewControl, CustomTreeSection, SideBarView, InputBox, WebView } from 'vscode-extension-tester';
import { FIVE_SECONDS, THIRTY_SECONDS, THREE_SECONDS } from './constants';

export async function createControl(): Promise<ViewControl | undefined> {
	const r = await new ActivityBar().getViewControl('Checkmarx');
	return r;
}

export async function createView(control: ViewControl): Promise<SideBarView | undefined> {
	return await control.openView();
}

export async function createTree(view: SideBarView | undefined): Promise<CustomTreeSection | undefined> {
	return await view?.getContent().getSection("Checkmarx One Results") as CustomTreeSection;
}

export async function initialize(): Promise<CustomTreeSection | undefined> {
	const control = await createControl();
	let view;
	if (control) {
		view = await createView(control);
	}
	return await createTree(view);
}

export async function initializeSCA(): Promise<CustomTreeSection | undefined> {
	const control = await createControl();
	let view;
	if (control) {
		view = await createView(control);
	}
	return await createTreeSCA(view);
}

export async function createTreeSCA(view: SideBarView | undefined): Promise<CustomTreeSection | undefined> {
	return await view?.getContent().getSection("Software Composition Analysis (SCA)") as CustomTreeSection;
}

export async function quickPickSelector(input: InputBox) {
	await input.selectQuickPick(0);
}
export async function getQuickPickSelector(input: InputBox): Promise<string> {
	let projectList = await input.getQuickPicks();
	return await projectList[0].getText();
}

export async function getResults(scan: any): Promise<any[]> {
	let children = await scan.getChildren();
	// Expand the first results
	await children![0].expand();
	let type = await children![0].getChildren();
	return type;
}

export async function validateSeverities(scan: any, severity: string): Promise<boolean> {
	var r = true;
	let children = await scan.getChildren();
	children.forEach((element: { getLabel: () => any; }) => {
		if (element.getLabel() === severity) {
			r = false;
		}
	});
	return r;
}

export async function getDetailsView(): Promise<WebView> {
	// Open details view
	try {
		let detailsView = new WebView();
		await detailsView.switchToFrame();
		return detailsView;
	} catch (error) {
		return undefined;
	}
}

export async function validateNestedGroupBy(level: number, engines: any): Promise<number> {
	let children = await engines.getChildren();
	// Recursive case, expand and get childrens from the node
	if (children.length > 0) {
		await children[0].expand();
		return validateNestedGroupBy(level + 1, children[0]);
	}
	// Stoppage case, when childrens list is empty
	return level;
}

export async function validateRootNode(scan: any): Promise<[number, any]> {
	await scan?.expand();
	// Validate engines type node
	let engines = await scan?.getChildren();
	let size = engines?.length;
	return [size, engines];
}


export const delay = (ms: number | undefined) => new Promise(res => setTimeout(res, ms));


export let isInstallVorpal = false
export let scanVorpalNum = 0;
 
export function changeVorpalStatus(value: boolean) {
    console.log("Vorpal status changed to: " + value);
    isInstallVorpal = value;
}
 
export function increaseScanVorpalNum() {
    console.log("Vorpal scan number increased to: " + scanVorpalNum + 1);
    scanVorpalNum = scanVorpalNum + 1;
}
