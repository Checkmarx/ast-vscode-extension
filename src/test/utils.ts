import { ActivityBar, ViewControl, CustomTreeSection, SideBarView, InputBox, CustomTreeItem} from 'vscode-extension-tester';
import { FIVE_SECONDS } from './constants';

export async function createControl(): Promise<ViewControl | undefined> {
	var r = await new ActivityBar().getViewControl('CxAST');
	return r;
}

export async function createView(control:ViewControl): Promise<SideBarView | undefined> {
	return await control.openView();
}	

export async function createTree(view:SideBarView|undefined): Promise<CustomTreeSection | undefined> {
	return await view?.getContent().getSection("Results") as CustomTreeSection ;
}	

export async function initialize(): Promise<CustomTreeSection | undefined> {
	let control = await createControl();
	let view;
	if(control){
		view = await createView(control);
	}
	return await createTree(view);
}

export async function quickPickSelector(input:InputBox){
	await input.selectQuickPick(0);
}
export async function getQuickPickSelector(input:InputBox): Promise<string> {
	let projectList = await input.getQuickPicks();
	console.log("getQuickPickSelector "+JSON.stringify(projectList));
	await delay(FIVE_SECONDS);
	return await projectList[0].getText();
}

export async function getResults(scan:any): Promise<any[]> {
	await delay(FIVE_SECONDS);
    let children = await scan.getChildren();
    await delay(FIVE_SECONDS);
    // Expand the first results
    await children![0].expand();
	await delay(FIVE_SECONDS);
    let type = await children![0].getChildren();
	await delay(FIVE_SECONDS);
    await type[0].expand();
	await delay(FIVE_SECONDS);
    return await type[0].getChildren();
}

export async function validateSeverities(scan:any, severity:string): Promise<boolean> {
	await delay(FIVE_SECONDS);
	var r=true;
    let children = await scan.getChildren();
    children.forEach((element: { getLabel: () => any; }) => {
		if(element.getLabel()===severity){
			r=false;
		}
	});
    return r;
}

export const delay = (ms: number | undefined) => new Promise(res => setTimeout(res, ms));