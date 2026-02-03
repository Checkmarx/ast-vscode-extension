import {
    CustomTreeSection,
    EditorView,
    InputBox,
    VSBrowser,
    WebDriver,
    Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import { initialize, waitForNotificationWithTimeout, validateRootNodeBool } from "./utils/utils";
import { CX_LOOK_SCAN, SCAN_KEY_TREE_LABEL, MESSAGES } from "./utils/constants";
import { EMPTY_RESULTS_SCAN_ID } from "./utils/envs";

describe("Scan ID load results test", () => {
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
            await new Promise((res) => setTimeout(res, 2000));
        } catch (error) {
            console.log("Failed to inject mock token:", error);
        }
    });

    after(async () => {
        await new EditorView().closeAllEditors();
    });

    it("should load results from scan ID", async function () {
        this.timeout(90000);

        await bench.executeCommand(CX_LOOK_SCAN);

        // Use InputBox.create() instead of new InputBox()
        const input = await InputBox.create();
        await new Promise((res) => setTimeout(res, 1000));

        await input.setText("e3b2505a-0634-4b41-8fa1-dfeb2edc26f7");
        await input.confirm();

        // Wait for scan to load
        await new Promise((res) => setTimeout(res, 5000));

        // Verify scan loaded
        treeScans = await initialize();
        let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);

        const maxAttempts = 60;
        let attempts = 0;

        while (scan === undefined && attempts < maxAttempts) {
            await new Promise((res) => setTimeout(res, 1000));
            treeScans = await initialize();
            scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
            attempts++;
        }

        expect(scan).to.not.be.undefined;
    });

    it("should check scan result is not undefined", async function () {
        // Make sure the results are loaded
        treeScans = await initialize();
        while (treeScans === undefined) {
            treeScans = await initialize();
        }
        let scan = await treeScans?.findItem(
            SCAN_KEY_TREE_LABEL
        );
        await scan?.expand();
        let scanChildren = await scan?.getChildren();
        const isValidated = await validateRootNodeBool(scan);
        expect(isValidated).to.equal(true);
    });
    it("should allow creating a new scan even if the current scan has zero results", async function () {
        this.timeout(120000);

        await bench.executeCommand(CX_LOOK_SCAN);

        // Use InputBox.create() with proper waiting
        const input = await InputBox.create();
        await new Promise((res) => setTimeout(res, 1000));

        await input.setText(EMPTY_RESULTS_SCAN_ID);
        await input.confirm();

        // Wait for scan to load
        await new Promise((res) => setTimeout(res, 5000));

        // Verify scan loaded
        treeScans = await initialize();
        let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);

        const maxAttempts = 60;
        let attempts = 0;

        while (scan === undefined && attempts < maxAttempts) {
            await new Promise((res) => setTimeout(res, 1000));
            treeScans = await initialize();
            scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
            attempts++;
        }

        // Now try to create a new scan
        await bench.executeCommand("ast-results.createScan");

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
                await new Promise((res) => setTimeout(res, 2000));
                firstNotification = await waitForNotificationWithTimeout(10000);
            }
        }

        expect(firstNotification).to.not.be.undefined;
    });
});