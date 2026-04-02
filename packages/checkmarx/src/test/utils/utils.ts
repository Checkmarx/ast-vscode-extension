import {
  ActivityBar,
  By,
  ViewControl,
  CustomTreeSection,
  SideBarView,
  InputBox,
  WebView,
  WebDriver,
  ViewSection,
  VSBrowser,
  Workbench,
  EditorView,
} from "vscode-extension-tester";
import { WEBVIEW_TITLE } from "./constants";

const CX_AUTHENTICATION_COMMAND = "ast-results.showAuth";
const CX_MOCK_TOKEN_COMMAND = "ast-results.mockTokenTest";
const AUTH_EDITOR_TITLE = "Checkmarx Authentication";

type CommandExecutor = (command: string) => Promise<void>;

async function executeCommand(
  bench: Workbench,
  command: string,
  executeCommandWithRetry?: CommandExecutor
): Promise<void> {
  if (executeCommandWithRetry) {
    await executeCommandWithRetry(command);
    return;
  }
  await bench.executeCommand(command);
}

async function openAuthenticationWebView(
  bench: Workbench,
  executeCommandWithRetry?: CommandExecutor,
  openDelayMs = 2000,
  frameTimeoutMs = 10000
): Promise<WebView> {
  await executeCommand(bench, CX_AUTHENTICATION_COMMAND, executeCommandWithRetry);
  await sleep(openDelayMs);
  await new EditorView().openEditor(AUTH_EDITOR_TITLE);
  const webView = new WebView();
  await webView.switchToFrame(frameTimeoutMs);
  return webView;
}

export async function safeSwitchBackFromWebView(webView: WebView): Promise<void> {
  try {
    await webView.switchBack();
  } catch {
    // Best-effort context cleanup.
  }
}

export async function confirmLogoutToast(
  driver: WebDriver,
  confirmationText = "Are you sure you want to log out?",
  waitAfterClickMs = 1500
): Promise<boolean> {
  const notifications = await driver.findElements(By.className("notification-toast"));
  for (const notification of notifications) {
    const notificationText = await notification.getText();
    if (!notificationText.includes(confirmationText)) {
      continue;
    }

    const buttons = await notification.findElements(By.css(".monaco-button"));
    for (const button of buttons) {
      try {
        const canClick = (await button.isDisplayed()) && (await button.isEnabled());
        if (canClick) {
          await button.click();
          await sleep(waitAfterClickMs);
          return true;
        }
      } catch {
        // Try next candidate button.
      }
    }

    return false;
  }

  return false;
}

export async function loginWithMockToken(
  bench: Workbench,
  options?: {
    executeCommandWithRetry?: CommandExecutor;
    waitMs?: number;
  }
): Promise<void> {
  await executeCommand(bench, CX_MOCK_TOKEN_COMMAND, options?.executeCommandWithRetry);
  await sleep(options?.waitMs ?? 2000);
}

export async function logoutIfVisible(
  bench: Workbench,
  driver: WebDriver,
  options?: {
    executeCommandWithRetry?: CommandExecutor;
    openDelayMs?: number;
    frameTimeoutMs?: number;
    waitAfterConfirmationMs?: number;
  }
): Promise<boolean> {
  const webView = await openAuthenticationWebView(
    bench,
    options?.executeCommandWithRetry,
    options?.openDelayMs,
    options?.frameTimeoutMs
  );

  try {
    const logoutButtons = await webView.findWebElements(By.id("logoutButton"));
    const canLogout = logoutButtons.length > 0 && (await logoutButtons[0].isDisplayed());

    if (!canLogout) {
      return false;
    }

    await logoutButtons[0].click();
    await safeSwitchBackFromWebView(webView);
    await confirmLogoutToast(
      driver,
      "Are you sure you want to log out?",
      options?.waitAfterConfirmationMs
    );

    return true;
  } finally {
    await safeSwitchBackFromWebView(webView);
  }
}

export async function createControl(): Promise<ViewControl | undefined> {
  const r = await new ActivityBar().getViewControl("Checkmarx");
  return r;
}

export async function createView(
  control: ViewControl
): Promise<SideBarView | undefined> {
  return await control.openView();
}

export async function createTree(
  view: SideBarView | undefined
): Promise<CustomTreeSection | undefined> {
  return (await view
    ?.getContent()
    .getSection("Checkmarx One Results")) as CustomTreeSection;
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

export async function createTreeSCA(
  view: SideBarView | undefined
): Promise<CustomTreeSection | undefined> {
  return (await view
    ?.getContent()
    .getSection("Checkmarx SCA Realtime Scanner")) as CustomTreeSection;
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

export async function clickFirstVulnerability(scan: any): Promise<void> {
  let vulnerabilities = await scan.getChildren();

  if (vulnerabilities.length > 0) {
    await vulnerabilities[0].click();
  }
}

export async function validateSeverities(
  scan: any,
  severity: string
): Promise<boolean> {
  var r = true;
  let children = await scan.getChildren();
  children.forEach((element: { getLabel: () => any }) => {
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

export async function validateNestedGroupBy(
  level: number,
  engines: any
): Promise<number> {
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

// Simple variant: expands root and returns true
export async function validateRootNodeBool(scan: any): Promise<boolean> {
  await scan?.expand();
  await scan?.getChildren();
  return true;
}

export async function waitForNotificationWithTimeout(timeout) {
  let firstNotification;
  let isTimeout = false;

  const timer = setTimeout(() => {
    isTimeout = true;
  }, timeout);

  while (!firstNotification) {
    if (isTimeout) {
      break;
    }
    const resultsNotifications = await new Workbench().getNotifications();
    firstNotification = resultsNotifications[0];

    await sleep(100);
  }

  clearTimeout(timer);
  return firstNotification;
}

export async function sleep(ms: number) {
  return await new Promise((resolve) => setTimeout(resolve, ms));
}

export function retryTest(testFn, retries = 3) {
  return async function (this: any) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await testFn.call(this);
        return;
      } catch (error) {
        lastError = error;
        console.warn(`Retrying test... Attempt ${attempt} of ${retries}`);
        if (attempt === retries) {
          throw lastError;
        }
      }
    }
  };
}

export const delay = (ms: number | undefined) =>
  new Promise((res) => setTimeout(res, ms));

export async function selectItem(text) {
  const input = await InputBox.create();
  await input.setText(text);
  let item = await getQuickPickSelector(input);
  await input.setText(item);
  await input.confirm();
  return item;
}

/**
 * Enters both iframe levels of the VS Code webview (outer .webview + inner #active-frame).
 * Iterates all found outer frames to skip competing webviews (e.g. Welcome tab).
 * Returns true when the Checkmarx details panel (cx_title) is reached.
 */
export async function openDetailsFrame(driver: WebDriver): Promise<boolean> {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await driver.switchTo().defaultContent();
      const webviewFrames = await driver.findElements(By.css(".webview.ready"));
      const framesToCheck = webviewFrames.length > 0
        ? webviewFrames
        : await driver.findElements(By.css(".webview"));
      for (const webviewFrame of framesToCheck) {
        try {
          await driver.switchTo().defaultContent();
          await driver.switchTo().frame(webviewFrame);
          const contentFrame = await driver.findElement(By.css("#active-frame"));
          await driver.switchTo().frame(contentFrame);
          // Presence of cx_title confirms this is the Checkmarx details panel.
          await driver.findElement(By.id(WEBVIEW_TITLE));
          return true;
        } catch {
          await driver.switchTo().defaultContent();
        }
      }
    } catch { /* outer frame lookup failed — retry */ }
    await sleep(1000);
  }
  return false;
}

/**
 * Clicks a tab radio input via JS to reliably switch tabs inside nested webview iframes.
 */
export async function selectDetailsTab(driver: WebDriver, tabId: string): Promise<void> {
  await driver.executeScript(`
    var tab = document.getElementById('${tabId}');
    tab.checked = true;
    tab.dispatchEvent(new Event('change', { bubbles: true }));
    tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  `);
  await sleep(500);
}

/**
 * Expands the requested sidebar panel and collapses all other visible panels.
 */
export async function focusPanelAndCollapseOthers(
  panelTitle: string
): Promise<ViewSection | undefined> {
  try {
    await VSBrowser.instance.waitForWorkbench(10000);
  } catch {
    // Continue with best-effort panel lookup.
  }

  let control: ViewControl | undefined;
  let view: SideBarView | undefined;

  try {
    control = await createControl();
    view = control ? await createView(control) : undefined;
  } catch {
    return undefined;
  }

  if (!view) {
    return undefined;
  }

  const content = view.getContent();
  const sections = await content.getSections();
  const normalizedTargetTitle = panelTitle.trim().toLowerCase();
  let targetSection: ViewSection | undefined;

  for (const section of sections) {
    try {
      const title = (await section.getTitle()).trim().toLowerCase();
      const isTarget = title === normalizedTargetTitle;

      if (isTarget) {
        await section.expand();
        targetSection = section;
      } else {
        await section.collapse();
      }
    } catch {
      // Ignore non-collapsible or transient sections.
    }
  }

  if (!targetSection) {
    try {
      targetSection = await content.getSection(panelTitle);
      await targetSection.expand();
    } catch {
      return undefined;
    }
  }

  return targetSection;
}
