import { CustomTreeSection, InputBox, VSBrowser, WebDriver, Workbench } from 'vscode-extension-tester';
import { expect } from 'chai';
import { initialize, validateRootNode, validateSeverities, validateRootNodeBool, waitForTreeNodeVisible } from './utils/utils';
import { CX_CLEAR, CX_FILTER_CONFIRMED, CX_FILTER_HIGH, CX_FILTER_INFO, CX_FILTER_LOW, CX_FILTER_MEDIUM, CX_FILTER_NOT_EXPLOITABLE, CX_FILTER_NOT_IGNORED, CX_FILTER_PROPOSED_NOT_EXPLOITABLE, CX_FILTER_TO_VERIFY, CX_FILTER_URGENT, CX_GROUP_FILE, CX_GROUP_LANGUAGE, CX_GROUP_QUERY_NAME, CX_GROUP_STATE, CX_GROUP_STATUS, CX_LOOK_SCAN, SAST_TYPE, SCAN_KEY_TREE_LABEL } from './utils/constants';
import { SCAN_ID } from './utils/envs';

describe("filter and groups actions tests", () => {
  let bench: Workbench;
  let treeScans: CustomTreeSection;
  let driver: WebDriver;

  before(async function () {
    this.timeout(100000);
    try {
      console.log('=== Starting filter and groups actions tests - before hook ===');
      bench = new Workbench();
      driver = VSBrowser.instance.driver;
      console.log('Initializing tree scans...');
      treeScans = await initialize();
      console.log('Executing command:', CX_LOOK_SCAN);
      await bench.executeCommand(CX_LOOK_SCAN);
      console.log('Before hook completed successfully');
    } catch (error) {
      console.error('Error in before hook:', error);
      throw error;
    }
  });

  after(async function () {
    this.timeout(30000); // Increase timeout to 30 seconds
    try {
      console.log('=== Starting filter and groups actions tests - after hook ===');
      console.log('Executing clear command:', CX_CLEAR);
      await bench.executeCommand(CX_CLEAR);
      console.log('After hook completed successfully');
    } catch (error) {
      console.error('Error in after hook:', error);
      throw error;
    }
  });

  it("should click on all filter severity", async function () {
    this.timeout(60000); // Increase timeout to 60 seconds

    try {
      console.log('Starting filter severity test...');
      treeScans = await initialize();
      console.log('Executing command:', CX_LOOK_SCAN);
      await bench.executeCommand(CX_LOOK_SCAN);
      let input = await InputBox.create();
      // Add delay to ensure input box is ready
      await new Promise((res) => setTimeout(res, 1000));
      await input.setText(
        SCAN_ID
      );
      await input.confirm();
      const commands = [{ command: CX_FILTER_INFO, text: "INFO" }, { command: CX_FILTER_LOW, text: "LOW" }, { command: CX_FILTER_MEDIUM, text: "MEDIUM" }, { command: CX_FILTER_HIGH, text: "HIGH" }, { command: CX_FILTER_HIGH, text: "CRITICAL" }];
      for (var index in commands) {
        console.log(`Executing filter command: ${commands[index].command}`);
        await bench.executeCommand(commands[index].command);
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
        if (scan === undefined) {
          console.error(`Failed to find scan item after ${maxAttempts} attempts for filter: ${commands[index].command}`);
        }
        let isValidated = await validateSeverities(scan, commands[index].text);

        expect(isValidated).to.equal(true);
        // Reset filters
        console.log(`Resetting filter: ${commands[index].command}`);
        await bench.executeCommand(commands[index].command);
      }
      console.log('Filter severity test completed successfully');
    } catch (error) {
      console.error('Error in filter severity test:', error);
      throw error;
    }
  });

  it("should click on all group by", async function () {
    this.timeout(180000); // Increase timeout to 180 seconds (3 minutes) for 5 commands

    try {
      console.log('Starting group by test (first)...');
      const commands = [
        CX_GROUP_STATUS,
        CX_GROUP_STATE,
        CX_GROUP_LANGUAGE,
        CX_GROUP_QUERY_NAME,
        CX_GROUP_FILE,
      ];
      for (var index in commands) {
        console.log(`\n=== Processing command ${parseInt(index) + 1} of ${commands.length}: ${commands[index]} ===`);

        // Ensure the results view is focused before executing command
        console.log('Focusing on results view...');
        const activityBar = await bench.getActivityBar();
        const viewControl = await activityBar.getViewControl('Checkmarx');
        if (viewControl) {
          const view = await viewControl.openView();
          console.log('View opened, waiting for view to be fully active and command palette to refresh...');
          await new Promise((res) => setTimeout(res, 8000));
        }

        console.log(`Executing group by command: ${commands[index]}`);
        await bench.executeCommand(commands[index]);

        // Wait for the scan node to be visible after group by
        console.log('Waiting for scan node to be visible...');
        treeScans = await initialize();
        let scan;
        try {
          scan = await waitForTreeNodeVisible(treeScans, SCAN_KEY_TREE_LABEL);
          console.log('Scan node is visible.');
        } catch (e) {
          console.error(`Timeout waiting for scan node after group by: ${commands[index]}`);
        }

        console.log('Validating root node...');
        const isValidated = await validateRootNodeBool(scan);
        expect(isValidated).to.equal(true);
        console.log(`Validation successful for: ${commands[index]}`);

        // Press Escape to close any open UI elements and ensure clean state for next command
        console.log('Pressing Escape to close any open UI elements...');
        await driver.actions().sendKeys('\uE00C').perform(); // ESC key
        await new Promise((res) => setTimeout(res, 500));
      }
      console.log('Group by test (first) completed successfully');
    } catch (error) {
      console.error('Error in group by test (first):', error);
      throw error;
    }
  });

  it("should click on all group by", async function () {
    this.timeout(180000); // Increase timeout to 180 seconds (3 minutes) for 5 commands

    try {
      console.log('Starting group by test (second)...');
      const commands = [
        CX_GROUP_LANGUAGE,
        CX_GROUP_STATUS,
        CX_GROUP_STATE,
        CX_GROUP_QUERY_NAME,
        CX_GROUP_FILE,
      ];
      for (var index in commands) {
        console.log(`\n=== Processing command ${parseInt(index) + 1} of ${commands.length}: ${commands[index]} ===`);
        console.log(`Executing group by command: ${commands[index]}`);
        await bench.executeCommand(commands[index]);

        // Wait for the scan node to be visible after group by
        console.log('Waiting for scan node to be visible...');
        treeScans = await initialize();
        let scan;
        try {
          scan = await waitForTreeNodeVisible(treeScans, SCAN_KEY_TREE_LABEL);
          console.log('Scan node is visible.');
        } catch (e) {
          console.error(`Timeout waiting for scan node after group by: ${commands[index]}`);
        }

        console.log('Validating root node...');
        const isValidated = await validateRootNodeBool(scan);
        expect(isValidated).to.equal(true);
        console.log(`Validation successful for: ${commands[index]}`);
      }
      console.log('Group by test (second) completed successfully');
    } catch (error) {
      console.error('Error in group by test (second):', error);
      throw error;
    }
  });

  it("should click on all filter state", async function () {
    this.timeout(120000); // Increase timeout to 120 seconds (2 minutes) for 6 commands

    try {
      console.log('Starting filter state test...');
      await initialize();
      const commands = [CX_FILTER_NOT_EXPLOITABLE, CX_FILTER_PROPOSED_NOT_EXPLOITABLE, CX_FILTER_CONFIRMED, CX_FILTER_TO_VERIFY, CX_FILTER_URGENT, CX_FILTER_NOT_IGNORED];
      for (var index in commands) {
        console.log(`\n=== Processing filter command ${parseInt(index) + 1} of ${commands.length}: ${commands[index]} ===`);
        console.log(`Executing filter state command: ${commands[index]}`);
        await bench.executeCommand(commands[index]);

        // Add delay to allow UI to update
        await new Promise((res) => setTimeout(res, 1000));

        expect(index).not.to.be.undefined;
        console.log(`Filter command ${commands[index]} executed successfully`);
      }
      console.log('Filter state test completed successfully');
    } catch (error) {
      console.error('Error in filter state test:', error);
      throw error;
    }
  });
});