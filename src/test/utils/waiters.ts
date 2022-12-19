import { By, StatusBar, until, WebDriver } from "vscode-extension-tester";

export async function waitStatusBar(){
	let statusbar = new StatusBar();
	let chekmarx = await statusbar.getItem('Checkmarx kics auto scan');
	while(chekmarx!==undefined){
		chekmarx = await statusbar.getItem('Checkmarx kics auto scan');
	}
}

export async function waitByLinkText(driver: WebDriver,text:string,timeout:number){
	driver.wait(until.elementLocated(By.linkText(text)), timeout);
}

export async function waitByClassName(driver: WebDriver,text:string, timeout:number){
	driver.wait(until.elementLocated(By.className(text)), timeout);
}