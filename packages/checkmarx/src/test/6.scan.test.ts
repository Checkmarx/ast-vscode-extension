import {
    CustomTreeSection,
    InputBox,
    VSBrowser,
    WebDriver,
    Workbench,
} from "vscode-extension-tester";
import { CX_CLEAR, CX_LOOK_SCAN, VS_OPEN_FOLDER, SCAN_KEY_TREE_LABEL, MESSAGES } from "./utils/constants";
import { waitByLinkText } from "./utils/waiters";
import { SCAN_ID } from "./utils/envs";
import { fail } from "assert";
import { initialize, retryTest, waitForNotificationWithTimeout, sleep } from "./utils/utils";
import { expect } from "chai";



describe("Scan from IDE", () => {
    let bench: Workbench;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

        // Open folder
        try {
            await bench.executeCommand(VS_OPEN_FOLDER);
            await sleep(2000);
            // Press Escape to close any open dialogs
            await driver.actions().sendKeys('\uE00C').perform();
        } catch (error) {
            console.log("VS_OPEN_FOLDER command failed or dialog handling failed:", error);
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

    it("should run scan from IDE", retryTest(async function () {
        this.timeout(120000);

        const treeScan = await initialize();

        // Load scan by ID
        await bench.executeCommand(CX_LOOK_SCAN);
        const input = await InputBox.create();
        await sleep(1000);
        await input.setText(SCAN_ID);
        await input.confirm();

        // Wait for scan to appear in tree
        await sleep(5000);

        let scan = await treeScan?.findItem(SCAN_KEY_TREE_LABEL);
        const maxAttempts = 60;
        let attempts = 0;

        while (scan === undefined && attempts < maxAttempts) {
            await sleep(1000);
            scan = await treeScan?.findItem(SCAN_KEY_TREE_LABEL);
            attempts++;
        }

        if (!scan) {
            throw new Error(`Scan ${SCAN_KEY_TREE_LABEL} not found after ${maxAttempts} attempts`);
        }

        // Ensure scan is expanded and loaded
        await scan.expand();
        await sleep(2000);

        // Initiate new scan
        await bench.executeCommand("ast-results.createScan");

        // Wait for notification
        let firstNotification = await waitForNotificationWithTimeout(10000);

        if (!firstNotification) {
            throw new Error("No notification received after creating scan");
        }

        let message = await firstNotification.getMessage();

        if (message === MESSAGES.scanProjectNotMatch) {
            let actions = await firstNotification.getActions();
            if (actions && actions.length > 0) {
                let action = actions[0];
                await action.click();
                await sleep(2000);
                firstNotification = await waitForNotificationWithTimeout(10000);
            }
        }

        expect(firstNotification).to.not.be.undefined;
    }));

    it.skip("should get wrong project notification", retryTest(async function () {
        const treeScan = await initialize();
        await bench.executeCommand(CX_LOOK_SCAN);
        const input = await InputBox.create();
        await input.setText(SCAN_ID);
        await input.confirm();
        await waitByLinkText(driver, SCAN_KEY_TREE_LABEL, 5000);
        let scan = await treeScan?.findItem(SCAN_KEY_TREE_LABEL);
        while (scan === undefined) {
            scan = await treeScan?.findItem(SCAN_KEY_TREE_LABEL);
        }
        // click play button(or initiate scan with command)
        await bench.executeCommand("ast-results.createScan");
        let firstNotification = await waitForNotificationWithTimeout(5000)
        let message = await firstNotification?.getMessage();
        if (message === MESSAGES.scanProjectNotMatch) {
            let actions = await firstNotification?.getActions()
            let action = await actions[1];
            await action.click();
        } else {
            fail("Should get wrong project notification");
        }

    }));
});
