import { Editor, Locator, WebElement, WebView } from "vscode-extension-tester";

export class LocatorUtility extends Editor{
	async findWebElement(locator: Locator): Promise<WebElement> {
		return this.getDriver().findElement(locator);
}
async findWebElements(locator: Locator): Promise<WebElement[]> {
	return this.getDriver().findElements(locator);
}

}