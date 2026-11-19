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

// Exact command palette label: extest only picks the entry whose label equals this text;
// anything else (a prefix or a command ID) presses Enter on the top fuzzy match, which VS Code
// ranks by recent use, so a different command can run.
const CX_AUTHENTICATION_COMMAND = "Checkmarx: Checkmarx: Show Authentication";
const CX_MOCK_TOKEN_COMMAND = "Mock Token Test";
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

  // Only real-tenant runs (CX_APIKEY set) need verification: validation is a network
  // call that can lose the race with extension start-up, so confirm and retry.
  if (!process.env.CX_APIKEY) {
    return;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const tree = await initialize();
      const items = tree ? await tree.getVisibleItems() : [];
      if (items.length > 0) {
        return;
      }
    } catch {
      // Tree not ready yet; retry below.
    }
    await sleep(8000);
    await executeCommand(bench, CX_MOCK_TOKEN_COMMAND, options?.executeCommandWithRetry);
    await sleep(5000);
  }
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
export async function getQuickPickSelector(input: InputBox, timeoutMs = 60000): Promise<string> {
  // Against a real tenant the picker list loads asynchronously and the typed filter is
  // applied after the unfiltered list first renders, so wait for an item matching the
  // typed text (when any) instead of taking whatever is first.
  const typed = ((await input.getText()) ?? "").trim().toLowerCase();
  const deadline = Date.now() + timeoutMs;
  let picks = await input.getQuickPicks();
  let match: string | undefined;
  while (Date.now() < deadline) {
    const texts: string[] = [];
    for (const pick of picks) {
      try {
        texts.push(await pick.getText());
      } catch {
        // Item re-rendered while reading; retry on next poll.
      }
    }
    match = typed
      ? texts.find((t) => t.trim().toLowerCase() === typed) ??
        texts.find((t) => t.toLowerCase().includes(typed))
      : texts[0];
    if (match !== undefined) {
      return match;
    }
    await sleep(1000);
    picks = await input.getQuickPicks();
  }
  return await picks[0].getText();
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

/**
 * True once no engine under the loaded scan lists a group for `severity` (i.e. the severity
 * filter took effect). Polls because the tree re-renders asynchronously after a filter
 * change, re-reading the tree each time so a stale element from the old render is never used.
 */
export async function validateSeverities(
  scan: any,
  severity: string,
  timeoutMs = 60000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let root = scan;
  for (;;) {
    try {
      const engines = await root.getChildren();
      let found = false;
      for (const engine of engines) {
        await engine.expand();
        for (const group of await engine.getChildren()) {
          if ((await group.getLabel()).trim().toUpperCase() === severity.toUpperCase()) {
            found = true;
          }
        }
      }
      if (!found && engines.length > 0) {
        return true;
      }
    } catch {
      // tree re-rendered while reading; re-read below
    }
    if (Date.now() >= deadline) {
      return false;
    }
    await sleep(1000);
    root = (await (await initialize())?.findItem("Scan")) ?? root;
  }
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

// Types text into the open picker and clicks the matching entry. The project/branch pickers
// search the server on every value change, so retyping the match and pressing Enter would
// clear the list and confirm while it reloads (nothing gets selected on a real tenant).
export async function selectItem(text: string): Promise<string> {
  const input = await InputBox.create();
  await input.setText(text);
  const item = await getQuickPickSelector(input);
  await clickQuickPickItem(input, item);
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

/**
 * Polls the Checkmarx One Results tree for an item until it appears. Against a real tenant the
 * view re-renders while a large scan loads, so a section captured earlier can go stale and keep
 * returning nothing - after a failed lookup the section is fetched again before the next poll.
 */
export async function waitForTreeItem(tree: any, label: string, timeoutMs = 60000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let section = tree;
  for (;;) {
    try {
      const item = await section?.findItem(label);
      if (item) {
        return item;
      }
    } catch {
      // stale section while the view re-renders; fetched again below
    }
    if (Date.now() >= deadline) {
      return undefined;
    }
    await sleep(1000);
    section = (await initialize()) ?? section;
  }
}

/**
 * Finds a child node (e.g. SAST, IaC, Secret Detection) of the loaded scan in the results tree.
 * Re-reads the scan root and the child on every poll: against a real tenant the tree is refreshed
 * while results load, so a reference captured once can go stale or the child may not exist yet.
 */
export async function waitForScanChild(tree: any, scanLabel: string, childLabel: string, timeoutMs = 60000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let child: any;
  do {
    try {
      const root = await tree?.findItem(scanLabel);
      if (root) {
        await root.expand();
        child = await root.findChildItem(childLabel);
      }
    } catch {
      // stale element while the tree refreshes; retry on the next poll
    }
    if (child) {
      return child;
    }
    await sleep(1000);
  } while (Date.now() < deadline);
  return undefined;
}

/**
 * Types `text` into a quick pick (only if it is not already there) and confirms it once an item with
 * that text is listed. The extension reloads the list on every text change, so pressing Enter right
 * after typing hits an empty list on a real tenant and nothing (or undefined) gets selected.
 */
export async function confirmQuickPickItem(input: InputBox, text: string, timeoutMs = 60000): Promise<void> {
  const current = ((await input.getText()) ?? "").trim();
  if (current !== text.trim()) {
    await input.setText(text);
    await sleep(1500); // debounce + list reset before the reload starts
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      for (const pick of await input.getQuickPicks()) {
        if ((await pick.getText()).trim() === text.trim()) {
          // click the item: Enter may not have an active item yet right after a reload
          await pick.select();
          return;
        }
      }
    } catch {
      // list re-rendered while reading; retry
    }
    await sleep(500);
  }
  await input.confirm();
}

/**
 * Clicks the quick pick item with the given text without typing anything. Used for the wizard,
 * whose lists are loaded up front and filtered client-side.
 */
export async function clickQuickPickItem(input: InputBox, text: string, timeoutMs = 60000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      for (const pick of await input.getQuickPicks()) {
        if ((await pick.getText()).trim() === text.trim()) {
          await pick.select();
          return;
        }
      }
    } catch {
      // list re-rendered while reading; retry
    }
    await sleep(500);
  }
  throw new Error(`Quick pick item "${text}" was not listed within ${timeoutMs} ms`);
}
