import { By, StatusBar, until, WebDriver } from "vscode-extension-tester";

export async function waitStatusBar(maxWaitTime: number = 30000) {
  const statusbar = new StatusBar();
  const startTime = Date.now();
  let chekmarx = await statusbar.getItem("Checkmarx kics real-time scan");

  while (chekmarx !== undefined) {
    // Check if we've exceeded the maximum wait time
    if (Date.now() - startTime > maxWaitTime) {
      console.warn(`waitStatusBar timed out after ${maxWaitTime}ms`);
      break;
    }

    // Add a small delay to prevent tight loop
    await new Promise((res) => setTimeout(res, 500));
    chekmarx = await statusbar.getItem("Checkmarx kics real-time scan");
  }
}

export async function waitByLinkText(
  driver: WebDriver,
  text: string,
  timeout: number
) {
  await driver.wait(until.elementLocated(By.linkText(text)), timeout);
}

export async function waitByClassName(
  driver: WebDriver,
  text: string,
  timeout: number
) {
  await driver.wait(until.elementLocated(By.className(text)), timeout);
}
