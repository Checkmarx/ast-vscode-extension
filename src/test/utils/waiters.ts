import { StatusBar } from "vscode-extension-tester";

export async function waitStatusBar(){
	let statusbar = new StatusBar();
	let chekmarx = await statusbar.getItem('Checkmarx kics auto scan');
	while(chekmarx!==undefined){
		chekmarx = await statusbar.getItem('Checkmarx kics auto scan');
	}
}