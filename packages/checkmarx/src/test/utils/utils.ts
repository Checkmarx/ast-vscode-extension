import {
  ActivityBar,
  By,
  ContextMenu,
  ViewControl,
  CustomTreeSection,
  SideBarView,
  InputBox,
  TreeItem,
  WebView,
  WebDriver,
  ViewSection,
  VSBrowser,
  Workbench,
  EditorView,
} from "vscode-extension-tester";
import { AUTH_EDITOR_TITLE, CX_AUTHENTICATION_COMMAND, SCAN_KEY_TREE_LABEL, WEBVIEW_TITLE } from "./constants";

const CX_MOCK_TOKEN_COMMAND = "Mock Token Test";
const RESULTS_PANEL_TITLE = "Checkmarx One Results";

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

export function isRealTenantRun(): boolean {
  return process.env.TEST === "uiEndToEnd" && Boolean(process.env.CX_APIKEY);
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

  // Only real-tenant runs need verification: validation is a network
  // call that can lose the race with extension start-up, so confirm and retry.
  if (!isRealTenantRun()) {
    return;
  }
  for (let retry = 0; ; retry++) {
    try {
      const tree = await initialize();
      const items = tree ? await tree.getVisibleItems() : [];
      if (items.length > 0) {
        return;
      }
    } catch {
      // Tree not ready yet; retry below.
    }
    if (retry === 5) {
      throw new Error("Real-tenant login did not fill the Checkmarx One Results tree after 5 retries");
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
  let next = scan;
  const hidden = await pollUntil(async () => {
    const root = next ?? (await (await initialize())?.findItem(SCAN_KEY_TREE_LABEL));
    next = undefined;
    const engines = await root.getChildren();
    let found = false;
    for (const engine of engines) {
      await engine.expand();
      for (const group of await engine.getChildren()) {
        found = found || (await group.getLabel()).trim().toUpperCase() === severity.toUpperCase();
      }
    }
    return engines.length > 0 && !found;
  }, Boolean, timeoutMs);
  return hidden === true;
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

// Waits up to timeoutMs for the quick input to be shown. InputBox.create(timeout) applies its
// timeout only to locating the element (VS Code keeps a hidden one in the DOM); the visibility
// wait after it is a fixed 5 s, which a picker that opens after a tenant call can exceed.
export async function waitForInputBox(timeoutMs = 30000): Promise<InputBox> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await InputBox.create(Math.max(1000, deadline - Date.now()));
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error;
      }
    }
  }
}

// Makes sure `folder` is the open workspace folder. extest opens it by running the VS Code CLI
// (`code -r <folder>`) against the test instance, and on the Linux CI runners that hand-off can
// leave the window without a folder ("Open Folder" watermark, title without the folder name), so
// anything resolved against the workspace (e.g. a result's file link) is never found. Falls back
// to File > Open Folder through VS Code's simple in-window dialog, which extest turns on.
export async function ensureWorkspaceFolderOpen(folder: string, timeoutMs = 60000): Promise<void> {
  const driver = VSBrowser.instance.driver;
  const name = folder.split(/[\\/]/).filter(Boolean).pop() ?? folder;
  const isOpen = async () => (await driver.getTitle()).includes(name);
  if (await isOpen()) {
    return;
  }
  console.log(`[ui-tests] No workspace folder open (title "${await driver.getTitle()}"); opening ${folder}`);
  await new Workbench().executeCommand("File: Open Folder...");
  const input = await waitForInputBox();
  await input.setText(folder);
  // In the simple dialog Enter only acts on the highlighted list entry; OK accepts the typed path.
  const okButtons = await driver.findElements(
    By.xpath("//div[contains(@class,'quick-input-widget')]//*[contains(@class,'monaco-button') and normalize-space(.)='OK']")
  );
  if (okButtons.length > 0) {
    await okButtons[0].click();
  } else {
    await input.confirm();
  }

  // Opening a folder reloads the window: wait for the new workbench, then for its title.
  const opened = await pollUntil(async () => {
    await VSBrowser.instance.waitForWorkbench(10000);
    return isOpen();
  }, Boolean, timeoutMs);
  if (!opened) {
    throw new Error(`Workspace folder ${folder} did not open (title: "${await driver.getTitle()}")`);
  }
}

// Types text into the open picker and clicks the matching entry. The project/branch pickers
// search the server on every value change, so retyping the match and pressing Enter would
// clear the list and confirm while it reloads (nothing gets selected on a real tenant).
export async function selectItem(text: string, timeoutMs = 60000): Promise<string> {
  const input = await waitForInputBox();
  await input.setText(text);
  const typed = text.trim().toLowerCase();
  return clickQuickPickItem(
    input,
    (entry, all) =>
      all.some((t) => t.toLowerCase() === typed) ? entry.toLowerCase() === typed : entry.toLowerCase().includes(typed),
    timeoutMs
  );
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
  let next = tree;
  return pollUntil(async () => {
    const section = next ?? (await initialize());
    next = undefined;
    return section?.findItem(label);
  }, Boolean, timeoutMs);
}

/**
 * Finds a child node (e.g. SAST, IaC, Secret Detection) of the loaded scan in the results tree.
 * Re-reads the scan root and the child on every poll: against a real tenant the tree is refreshed
 * while results load, so a reference captured once can go stale or the child may not exist yet.
 */
export async function waitForScanChild(
  tree: CustomTreeSection | undefined,
  scanLabel: string,
  childLabel: string,
  timeoutMs = 60000
): Promise<TreeItem> {
  let next = tree;
  return pollUntil(async () => {
    const section = next ?? (await initialize());
    next = undefined;
    const root = await section?.findItem(scanLabel);
    await root?.expand();
    return root?.findChildItem(childLabel);
  }, Boolean, timeoutMs);
}

// Polls `read` until `done` accepts the value (a throw counts as a miss); on timeout returns the last value read.
export async function pollUntil<T>(
  read: () => Promise<T>,
  done: (value: NoInfer<T>) => boolean = Boolean,
  timeoutMs = 60000,
  intervalMs = 1000
): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  let value: T | undefined;
  for (;;) {
    try {
      value = await read();
      if (done(value)) {
        return value;
      }
    } catch {
      // stale element; read again
    }
    if (Date.now() >= deadline) {
      return value;
    }
    await sleep(intervalMs);
  }
}

// Clicks the first entry `match` accepts once two reads list the same entries: VS Code reuses rows while results arrive.
export async function clickQuickPickItem(
  input: InputBox,
  match?: string | ((text: string, all: string[]) => boolean),
  timeoutMs = 60000
): Promise<string> {
  const accepts = typeof match === "string" ? (text: string) => text === match.trim() : match ?? (() => true);
  let previous: string | undefined;
  let listed: string[] = [];
  const found = await pollUntil(async () => {
    const last = previous;
    previous = undefined;
    const picks = await input.getQuickPicks();
    const texts: string[] = [];
    for (const pick of picks) {
      texts.push((await pick.getText()).trim());
    }
    listed = texts;
    previous = texts.join("|");
    const index = previous === last ? texts.findIndex((text) => accepts(text, texts)) : -1;
    return index >= 0 ? { pick: picks[index], text: texts[index] } : undefined;
  }, Boolean, timeoutMs, 500);
  if (!found) {
    const wanted = typeof match === "string" ? `"${match}"` : "the expected entry";
    throw new Error(`Quick pick did not list ${wanted} within ${timeoutMs} ms (listed: ${JSON.stringify(listed)})`);
  }
  await found.pick.select();
  return found.text;
}

type MenuStatus = { label: string; isActive: boolean };
export type ResultsMenu = "More Actions" | "Filter";

// Unchecked labels are padded with soft hyphens (U+00AD); checked ones start with a check mark.
function parseMenuItemLabel(rawLabel: string): MenuStatus {
  const label = rawLabel.replace(/\u00AD/g, "").replace(/\s+/g, " ").trim();
  const isActive = label.startsWith("\u2713 ");
  return { label: isActive ? label.slice(2).trim() : label, isActive };
}

// Selecting the scan enables menu items gated by `view == astResults`.
export async function focusResultsPanelAndSelectScan(): Promise<void> {
  await focusPanelAndCollapseOthers(RESULTS_PANEL_TITLE);
  try {
    const scan = await (await initialize())?.findItem(SCAN_KEY_TREE_LABEL);
    if (scan) {
      await scan.select();
      await sleep(300);
    }
  } catch {
    // best-effort
  }
}

// `refocus` focuses the panel before every open; otherwise only before retries.
export async function openResultsMenu(kind: ResultsMenu, refocus = true): Promise<ContextMenu | undefined> {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      if (refocus || attempt > 1) {
        await focusResultsPanelAndSelectScan();
      }
      const section = await initialize();
      if (kind === "More Actions") {
        const menu = await section?.moreActions();
        if (menu) {
          return menu;
        }
      } else {
        // fall back to any action labelled like "filter"
        let action = await section?.getAction("Filter");
        for (const candidate of action ? [] : (await section?.getActions()) ?? []) {
          if (/filter/i.test(await candidate.getLabel())) {
            action = candidate;
            break;
          }
        }
        const menu = await action?.open();
        if (menu) {
          return menu;
        }
      }
    } catch {
      // panel actions not ready yet; retry
    }
    await sleep(1000);
  }
  return undefined;
}

export async function readResultsMenu(kind: ResultsMenu, refocus = true): Promise<MenuStatus[]> {
  const menu = await openResultsMenu(kind, refocus);
  if (!menu) {
    return [];
  }
  try {
    const statuses: MenuStatus[] = [];
    for (const item of await menu.getItems()) {
      statuses.push(parseMenuItemLabel(await item.getLabel()));
    }
    return statuses;
  } catch {
    return [];
  } finally {
    await menu.close().catch(() => undefined);
  }
}

// Clicks `label` and (with `confirm`) waits for a fresh read to show the flip, clicking again only if it has not
// flipped. Returns undefined if the item is missing or never flips.
export async function toggleResultsMenuOption(
  kind: ResultsMenu,
  label: string,
  options: { confirm?: boolean; refocus?: boolean; timeoutMs?: number } = {}
): Promise<{ before: boolean; after: boolean } | undefined> {
  const { confirm = true, refocus = true, timeoutMs = 8000 } = options;
  let before: boolean | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const menu = await openResultsMenu(kind, refocus || attempt > 1);
    if (!menu) {
      return undefined;
    }
    try {
      let target;
      let isActive = false;
      for (const item of await menu.getItems()) {
        const status = parseMenuItemLabel(await item.getLabel());
        if (status.label === label) {
          target = item;
          isActive = status.isActive;
          break;
        }
      }
      if (!target) {
        return undefined;
      }
      if (before === undefined) {
        before = isActive;
      } else if (isActive !== before) {
        return { before, after: isActive }; // first click landed late
      }
      await target.select();
    } catch {
      return undefined;
    } finally {
      await menu.close().catch(() => undefined);
    }
    if (!confirm) {
      return { before, after: !before };
    }
    await sleep(1000);
    const flipped = await pollUntil(
      async () => (await readResultsMenu(kind, refocus)).find((status) => status.label === label)?.isActive === !before,
      Boolean,
      timeoutMs
    );
    if (flipped) {
      return { before, after: !before };
    }
  }
  return undefined;
}
