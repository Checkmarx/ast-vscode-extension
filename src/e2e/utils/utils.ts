import {
    CustomTreeSection,
    InputBox
  } from "vscode-extension-tester";
  import {  sleep } from "../../test/utils/utils";

export async function waitForElementToAppear(
    treeScans: CustomTreeSection,
    key: string,
    maxRetries = 20,
    retryDelay = 500
  ) {
    for (let i = 0; i < maxRetries; i++) {
      const element = await treeScans?.findItem(key);
      if (element) {
        return element;
      }
      await sleep(retryDelay);
    }
  }

  export async function waitForInputBoxToOpen(maxRetries = 30, retryDelay = 800) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const input = await InputBox.create();
        if (input) {
          return input;
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
    throw new Error("InputBox did not open in time.");
  }
  
  export async function selectItem(input: InputBox, itemName: string) {
    await input.setText(itemName);
    
    const selectedItem = await getQuickPickSelector(input);
    await input.setText(selectedItem);
    await input.confirm();
    return selectedItem;
  }

  async function getQuickPickSelector(input: InputBox): Promise<string> {
    const retries = 20;
    let projectList = [];
  
    
    for (let i = 0; i < retries; i++) {
      projectList = await input.getQuickPicks();
      if (projectList.length > 0) {
        break;
      }
      await sleep(500); 
    }
  
    if (projectList.length === 0) {
      throw new Error("Failed to load project list in QuickPickSelector");
    }
  
    return projectList[0].getText();
  }