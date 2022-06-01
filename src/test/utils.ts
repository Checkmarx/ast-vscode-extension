import { ActivityBar, ViewControl, CustomTreeSection, SideBarView, InputBox, WebView} from 'vscode-extension-tester';
import { FIVE_SECONDS, THREE_SECONDS } from './constants';

export async function createControl(): Promise<ViewControl | undefined> {
	var r = await new ActivityBar().getViewControl('Checkmarx');
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
	return type;
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

export async function getDetailsView(): Promise<WebView> {
	// Open details view
	let detailsView = new WebView();
	await delay(FIVE_SECONDS);
	await detailsView.switchToFrame();
	await delay(FIVE_SECONDS);
	return detailsView;
}

export async function validateNestedGroupBy(level:number,engines:any):Promise<number>{
	let children = await engines.getChildren();
	await delay(THREE_SECONDS);
	// Recursive case, expand and get childrens from the node
	if(children.length>0){
		await children[0].expand();
		await delay(THREE_SECONDS);
		return validateNestedGroupBy(level+1,children[0]);
	}
	// Stoppage case, when childrens list is empty
	return level;
}

export async function validateRootNode(scan:any):Promise<[number,any]>{
	await scan?.expand();
	await delay(THREE_SECONDS);
	// Validate engines type node
	let engines = await scan?.getChildren();
	await delay(THREE_SECONDS);
	let size = engines?.length;
	return [size,engines];
}

 
export const delay = (ms: number | undefined) => new Promise(res => setTimeout(res, ms));