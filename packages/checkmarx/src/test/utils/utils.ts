import {
  ActivityBar,
  ViewControl,
  CustomTreeSection,
  SideBarView,
  InputBox,
  WebView,
  Workbench,
} from "vscode-extension-tester";
import { FIVE_SECONDS, THIRTY_SECONDS, THREE_SECONDS } from "./constants";

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
