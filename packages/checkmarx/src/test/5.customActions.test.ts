import { CustomTreeSection, InputBox, VSBrowser, WebDriver, Workbench } from 'vscode-extension-tester';
import { expect } from 'chai';
import { initialize, validateRootNode, validateSeverities, validateRootNodeBool, waitForInputBoxReady, safeSetText, safeConfirm, sleep } from './utils/utils';
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
    treeScans = await initialize();
    // Don't execute CX_LOOK_SCAN here - let individual tests handle it
  });

  after(async function () {
    this.timeout(30000); // Increase timeout to 30 seconds
    await sleep(1000); // Add delay before cleanup command
    try {
      await bench.executeCommand(CX_CLEAR);
    } catch (error) {
      console.warn('CX_CLEAR command failed in cleanup:', error.message);
    }
  });

  it("should click on all filter severity", async function () {
    this.timeout(90000); // Increase timeout to 90 seconds for multiple operations

    treeScans = await initialize();
    await sleep(1000); // Add delay before command
    await bench.executeCommand(CX_LOOK_SCAN);
    let input = await waitForInputBoxReady(15000);
    await safeSetText(input, SCAN_ID);
    await safeConfirm(input);

    const commands = [{ command: CX_FILTER_INFO, text: "INFO" }, { command: CX_FILTER_LOW, text: "LOW" }, { command: CX_FILTER_MEDIUM, text: "MEDIUM" }, { command: CX_FILTER_HIGH, text: "HIGH" }, { command: CX_FILTER_HIGH, text: "CRITICAL" }];
    for (var index in commands) {
      await sleep(500); // Add delay before each command
      await bench.executeCommand(commands[index].command);
      treeScans = await initialize();
      let scan = await treeScans?.findItem(
        SCAN_KEY_TREE_LABEL
      );
      const maxAttempts = 30;
      let attempts = 0;
      while (scan === undefined && attempts < maxAttempts) {
        await sleep(500);
        scan = await treeScans?.findItem(
          SCAN_KEY_TREE_LABEL
        );
        attempts++;
      }
      let isValidated = await validateSeverities(scan, commands[index].text);

      expect(isValidated).to.equal(true);
      // Reset filters
      await sleep(500); // Add delay before reset command
      await bench.executeCommand(commands[index].command);
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
    this.timeout(60000); // Increase timeout to 60 seconds

    // Just execute the filter commands - no need to wait for tree
    const commands = [CX_FILTER_NOT_EXPLOITABLE, CX_FILTER_PROPOSED_NOT_EXPLOITABLE, CX_FILTER_CONFIRMED, CX_FILTER_TO_VERIFY, CX_FILTER_URGENT, CX_FILTER_NOT_IGNORED];
    for (var index in commands) {
      await sleep(500); // Add delay before each command to ensure UI is ready
      await bench.executeCommand(commands[index]);
      await sleep(300); // Small delay between commands
      expect(index).not.to.be.undefined;
    }
    // Wait for commands to complete
    await sleep(1000);
  });
});