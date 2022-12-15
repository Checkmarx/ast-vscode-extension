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
import { CX_CLEAR, CX_LOOK_SCAN, VS_OPEN_FOLDER } from "./constants";

describe("Scan from IDE", () => {
  let bench: Workbench;
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

  it("should open the project to scan", async function () {
    const appender = process.platform === "win32" ? "\\" : "/";
    const tempPath = __dirname + appender + "TestZip";
    await bench.executeCommand(VS_OPEN_FOLDER);
    await delay(1000);
    // open project folder
    let input = await InputBox.create();
    await input.setText(tempPath);
    await input.confirm();
    await  bench.executeCommand(CX_LOOK_SCAN);
  });

  it("should run scan from IDE", async function () {
    let treeScan = await initialize();
    await  bench.executeCommand(CX_LOOK_SCAN);
    let input = await InputBox.create();
    await input.setText(
      // process.env.CX_TEST_SCAN_ID ? process.env.CX_TEST_SCAN_ID : "6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c"
      "6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c"
    );
    await input.confirm();
    driver.wait(
      until.elementLocated(
        By.linkText(
          // "Scan:  " + process.env.CX_TEST_SCAN_ID
          "Scan:  " + "6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c"
        )
      ),
      15000
    );
    let scan = await treeScan?.findItem(
      // "Scan:  " + scanId
      "Scan:  " + "6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c"
    );
    while (scan === undefined) {
      scan = await treeScan?.findItem(
        // "Scan:  " + scanId
        "Scan:  " + "6ee2d7f3-cc88-4d0f-851b-f98a99e54c1c"
      );
    }
    // click play button(or initiate scan with command)
    await bench.executeCommand("ast-results.createScan");

    const resultsNotifications = await new Workbench().getNotifications();
    const firstNotification = resultsNotifications[0];
    expect(firstNotification).is.not.undefined;
  });
});
