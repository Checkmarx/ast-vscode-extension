import {
  By,
  CustomTreeSection,
  InputBox,
  until,
  VSBrowser,
  WebDriver,
  Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import { delay, initialize } from "./utils/utils";
import { CX_CLEAR, CX_LOOK_SCAN, SCAN_KEY_TREE, VS_OPEN_FOLDER } from "./utils/constants";
import { waitByLinkText } from "./utils/waiters";
import { SCAN_ID } from "./utils/envs";

describe("Scan from IDE", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

  // before(async function () {
  //   this.timeout(100000);
  //   bench = new Workbench();
  //   driver = VSBrowser.instance.driver;
  //   treeScans = await initialize();
  //   await bench.executeCommand(VS_OPEN_FOLDER);
  // });

  // after(async () => {
  //   await bench.executeCommand(CX_CLEAR);
  // });

  // it("should run scan from IDE", async function () {
  //   let treeScan = await initialize();
  //   await  bench.executeCommand(CX_LOOK_SCAN);
  //   let input = await InputBox.create();
  //   await input.setText(
  //     SCAN_ID 
  //   );
  //   await input.confirm();
  //   await waitByLinkText(driver,  SCAN_KEY_TREE + SCAN_ID, 5000);
  //   let scan = await treeScan?.findItem(
  //     SCAN_KEY_TREE + SCAN_ID 
  //   );
  //   while (scan === undefined) {
  //     scan = await treeScan?.findItem(
  //       SCAN_KEY_TREE + SCAN_ID 
  //     );
  //   }
  //   // click play button(or initiate scan with command)
  //   await bench.executeCommand("ast-results.createScan");

  //   const resultsNotifications = await new Workbench().getNotifications();
  //   const firstNotification = resultsNotifications[0];
  //   expect(firstNotification).is.not.undefined;
  // });
});
