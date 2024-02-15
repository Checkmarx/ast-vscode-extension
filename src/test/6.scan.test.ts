import {
  CustomTreeSection,
  InputBox,
  VSBrowser,
  WebDriver,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import { initialize } from "./utils/utils";
import { CX_CLEAR, CX_LOOK_SCAN, VS_OPEN_FOLDER, SCAN_KEY_TREE_SINGLE_SPACE } from "./utils/constants";
import { waitByLinkText } from "./utils/waiters";
import { SCAN_ID } from "./utils/envs";

describe("Scan from IDE", () => {
  let bench: Workbench;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

  before(async function () {
    this.timeout(100000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;
    treeScans = await initialize();
    await bench.executeCommand(VS_OPEN_FOLDER);
  });

  after(async () => {
    await bench.executeCommand(CX_CLEAR);
  });

  it("should run scan from IDE", async function () {
    const treeScan = await initialize();
    await bench.executeCommand(CX_LOOK_SCAN);
    const input = await InputBox.create();
    await input.setText(SCAN_ID);
    await input.confirm();
    await waitByLinkText(driver, SCAN_KEY_TREE_SINGLE_SPACE, 5000);
    let scan = await treeScan?.findItem(SCAN_KEY_TREE_SINGLE_SPACE);
    while (scan === undefined) {
      scan = await treeScan?.findItem(SCAN_KEY_TREE_SINGLE_SPACE);
    }
    // click play button(or initiate scan with command)
    await bench.executeCommand("ast-results.createScan");

    const resultsNotifications = await new Workbench().getNotifications();
    const firstNotification = resultsNotifications[0];
    expect(firstNotification).is.not.undefined;
  });
});
