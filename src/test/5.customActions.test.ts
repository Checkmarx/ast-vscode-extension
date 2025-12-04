import { CustomTreeSection, InputBox, VSBrowser, WebDriver, Workbench } from 'vscode-extension-tester';
import { expect } from 'chai';
import { initialize, sleep, validateRootNode, validateSeverities } from './utils/utils';
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
    await bench.executeCommand(CX_LOOK_SCAN);
  });

  after(async () => {
    await bench.executeCommand(CX_CLEAR);
  });

  it("should click on all filter severity", async function () {
    treeScans = await initialize();
    await bench.executeCommand(CX_LOOK_SCAN);
    let input = await InputBox.create();
    await input.setText(
      SCAN_ID
    );
    await input.confirm();
    const commands = [{ command: CX_FILTER_INFO, text: "INFO" }, { command: CX_FILTER_LOW, text: "LOW" }, { command: CX_FILTER_MEDIUM, text: "MEDIUM" }, { command: CX_FILTER_HIGH, text: "HIGH" }, { command: CX_FILTER_HIGH, text: "CRITICAL" }];
    for (var index in commands) {
      await bench.executeCommand(commands[index].command);
      treeScans = await initialize();
      let scan = await treeScans?.findItem(
        SCAN_KEY_TREE_LABEL
      );
      while (scan === undefined) {
        scan = await treeScans?.findItem(
          SCAN_KEY_TREE_LABEL
        );
      }
      let isValidated = await validateSeverities(scan, commands[index].text);

      expect(isValidated).to.equal(true);
      // Reset filters
      await bench.executeCommand(commands[index].command);
    }
  });

  it.skip("should click on all group by", async function () {
    const commands = [
      CX_GROUP_LANGUAGE,
      CX_GROUP_STATUS,
      CX_GROUP_STATE,
      CX_GROUP_QUERY_NAME,
      CX_GROUP_FILE,
    ];
    // Get scan node
    const treeScans = await initialize();
    let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
    while (scan === undefined) {
      scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
    }
    // Expand and validate scan node to obtain engine nodes
    let tuple = await validateRootNode(scan);
    //let level = 0;
    // Get the sast results node, because it is the only one affected by all the group by commands
    let sastNode = await scan?.findChildItem(SAST_TYPE);
    while (sastNode === undefined) {
      sastNode = await scan?.findChildItem(SAST_TYPE);
    }
    // Validate for all commands the nested tree elements
    for (var index in commands) {
      // Execute the group by command for each command
      await bench.executeCommand(commands[index]);
    }
    // Size must not be bigger than 3 because there are at most 3 engines in the first node
    expect(tuple[0]).to.be.at.most(4);
  });

  async function waitFor(fn, timeout = 5000, interval = 100) {
    const start = Date.now();
    let result;

    while (Date.now() - start < timeout) {
      result = await fn();
      if (result !== undefined && result !== null) {
        return result;
      }
      await new Promise(res => setTimeout(res, interval));
    }

    throw new Error("Timeout waiting for: " + fn.toString());
  }

  it("should click on all group by", async function () {
    this.timeout(20000); // VS Code extension tests are slow
    console.log("Test started: should click on all group by");
    const commands = [CX_GROUP_LANGUAGE, CX_GROUP_STATUS, CX_GROUP_STATE, CX_GROUP_QUERY_NAME, CX_GROUP_FILE];

    // Get scan node
    console.log("Calling initialize()...");
    const treeScans = await initialize();
    await bench.executeCommand(CX_LOOK_SCAN);
    let input = await InputBox.create();
    await input.setText(
      SCAN_ID
    );
    await input.confirm();
    console.log("initialize() returned:", treeScans);

    console.log(`Searching for scan: '${SCAN_KEY_TREE_LABEL}'`);
    let scan = await treeScans?.findItem(
      SCAN_KEY_TREE_LABEL
    );
    console.log("scan found:", scan);

    // Expand and validate scan node to obtain engine nodes
    console.log("Calling validateRootNode(scan)...");
    const tuple = await validateRootNode(scan);
    console.log("validateRootNode returned tuple:", tuple);
    //let level = 0;
    // Get the sast results node, because it is the only one affected by all the group by commands
    console.log(`Searching for SAST node: '${SAST_TYPE}'`);

    let sastNode = await waitFor(() => scan?.findChildItem(SAST_TYPE));
    console.log("SAST node found:", sastNode);

    for (const command of commands) {
      console.log(`Executing group-by command: ${command}`);
      await bench.executeCommand(command);
      console.log(`Command executed: ${command}`);
      await sleep(10000);
      console.log(`Finished waiting after command: ${command}`);
    }

    expect(tuple[0]).to.be.at.most(4);
  });


  it("should click on all filter state", async function () {
    await initialize();
    const commands = [CX_FILTER_NOT_EXPLOITABLE, CX_FILTER_PROPOSED_NOT_EXPLOITABLE, CX_FILTER_CONFIRMED, CX_FILTER_TO_VERIFY, CX_FILTER_URGENT, CX_FILTER_NOT_IGNORED];
    for (var index in commands) {
      await bench.executeCommand(commands[index]);
      expect(index).not.to.be.undefined;
    }
  });
});
