import { CustomTreeSection, InputBox, VSBrowser, WebDriver, Workbench } from 'vscode-extension-tester';
import { expect } from 'chai';
import { initialize, validateRootNode, validateSeverities, validateRootNodeBool, sleep } from './utils/utils';
import { CX_CLEAR, CX_FILTER_CONFIRMED, CX_FILTER_HIGH, CX_FILTER_INFO, CX_FILTER_LOW, CX_FILTER_MEDIUM, CX_FILTER_NOT_EXPLOITABLE, CX_FILTER_NOT_IGNORED, CX_FILTER_PROPOSED_NOT_EXPLOITABLE, CX_FILTER_TO_VERIFY, CX_FILTER_URGENT, CX_GROUP_FILE, CX_GROUP_LANGUAGE, CX_GROUP_QUERY_NAME, CX_GROUP_STATE, CX_GROUP_STATUS, CX_LOOK_SCAN, SAST_TYPE, SCAN_KEY_TREE_LABEL } from './utils/constants';
import { SCAN_ID } from './utils/envs';

describe("filter and groups actions tests", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

  before(async function () {
    this.timeout(100000);
    bench = new Workbench();
    driver = VSBrowser.instance.driver;

    // Ensure extension is ready
    try {
      await bench.executeCommand("ast-results.mockTokenTest");
      await sleep(2000);
    } catch (error) {
      console.log("Failed to inject mock token:", error);
    }
  });

  after(async function () {
    this.timeout(30000);
    try {
      await bench.executeCommand(CX_CLEAR);
    } catch (error) {
      console.log("CX_CLEAR command failed in cleanup:", error);
      // Don't fail the test suite if cleanup fails
    }
  });

  it("should click on all filter severity", async function () {
    this.timeout(90000);

    // Load scan first
    await bench.executeCommand(CX_LOOK_SCAN);
    const input = await InputBox.create();
    await sleep(1000);
    await input.setText(SCAN_ID);
    await input.confirm();

    // Wait for scan to load
    await sleep(5000);
    treeScans = await initialize();

    let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
    const maxAttempts = 60;
    let attempts = 0;
    while (scan === undefined && attempts < maxAttempts) {
      await sleep(500);
      scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
      attempts++;
    }

    if (!scan) {
      throw new Error("Scan not loaded after waiting");
    }

    const commands = [{ command: CX_FILTER_INFO, text: "INFO" }, { command: CX_FILTER_LOW, text: "LOW" }, { command: CX_FILTER_MEDIUM, text: "MEDIUM" }, { command: CX_FILTER_HIGH, text: "HIGH" }];

    for (const cmd of commands) {
      await bench.executeCommand(cmd.command);
      await sleep(1000);

      treeScans = await initialize();
      scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);

      let retries = 0;
      while (scan === undefined && retries < 30) {
        await sleep(500);
        scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
        retries++;
      }

      const isValidated = await validateSeverities(scan, cmd.text);
      expect(isValidated).to.equal(true);

      // Reset filter
      await bench.executeCommand(cmd.command);
      await sleep(500);
    }
  });

  it.skip("should click on all group by", async function () {
    this.timeout(60000); // Increase timeout to 60 seconds

    const commands = [
      CX_GROUP_LANGUAGE,
      CX_GROUP_STATUS,
      CX_GROUP_STATE,
      CX_GROUP_QUERY_NAME,
      CX_GROUP_FILE,
    ];
    for (var index in commands) {
      await bench.executeCommand(commands[index]);
      treeScans = await initialize();
      let scan = await treeScans?.findItem(
        SCAN_KEY_TREE_LABEL
      );
      const maxAttempts = 30;
      let attempts = 0;
      while (scan === undefined && attempts < maxAttempts) {
        await new Promise((res) => setTimeout(res, 500));
        scan = await treeScans?.findItem(
          SCAN_KEY_TREE_LABEL
        );
        attempts++;
      }
      const isValidated = await validateRootNodeBool(scan);
      expect(isValidated).to.equal(true);
      await bench.executeCommand(commands[index]);
    }
  });

  it.skip("should click on all group by", async function () {
    this.timeout(60000); // Increase timeout to 60 seconds

    const commands = [
      CX_GROUP_LANGUAGE,
      CX_GROUP_STATUS,
      CX_GROUP_STATE,
      CX_GROUP_QUERY_NAME,
      CX_GROUP_FILE,
    ];
    for (var index in commands) {
      await bench.executeCommand(commands[index]);
      treeScans = await initialize();
      let scan = await treeScans?.findItem(
        SCAN_KEY_TREE_LABEL
      );
      const isValidated = await validateRootNodeBool(scan);
      expect(isValidated).to.equal(true);
      await bench.executeCommand(commands[index]);
    }
  });

  it("should click on all filter state", async function () {
    this.timeout(90000);

    // Ensure scan is loaded first
    treeScans = await initialize();
    let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);

    if (!scan) {
      // Load scan if not already loaded
      await bench.executeCommand(CX_LOOK_SCAN);
      const input = await InputBox.create();
      await sleep(1000);
      await input.setText(SCAN_ID);
      await input.confirm();
      await sleep(5000);

      treeScans = await initialize();
      scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);

      const maxAttempts = 60;
      let attempts = 0;
      while (scan === undefined && attempts < maxAttempts) {
        await sleep(500);
        scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
        attempts++;
      }
    }

    if (!scan) {
      throw new Error("Scan not loaded - cannot test filters");
    }

    const commands = [CX_FILTER_NOT_EXPLOITABLE, CX_FILTER_PROPOSED_NOT_EXPLOITABLE, CX_FILTER_CONFIRMED, CX_FILTER_TO_VERIFY, CX_FILTER_URGENT, CX_FILTER_NOT_IGNORED];

    for (const command of commands) {
      await bench.executeCommand(command);
      await sleep(500);

      // Verify tree is still accessible
      treeScans = await initialize();
      expect(treeScans).not.to.be.undefined;
    }
  });
});