import {
    CustomTreeSection,
    EditorView,
    InputBox,
    VSBrowser,
    WebDriver,
    Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import { initialize, waitForNotificationWithTimeout, validateRootNodeBool, waitForInputBoxReady, safeSetText, safeConfirm, sleep } from "./utils/utils";
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
    });

    after(async function () {
        this.timeout(10000); // Increase timeout for cleanup
        await new EditorView().closeAllEditors();
    });

    it("should load results from scan ID", async function () {
        this.timeout(60000); // Increase timeout to 60 seconds

        await bench.executeCommand(CX_LOOK_SCAN);
        let input = await waitForInputBoxReady(15000);
        await safeSetText(input, "e3b2505a-0634-4b41-8fa1-dfeb2edc26f7");
        await safeConfirm(input);
        await sleep(3000); // Wait for results to load
    });

    it("should check scan result is not undefined", async function () {
        this.timeout(10000); // Increase timeout
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
        this.timeout(60000); // Increase timeout to 60 seconds

        await bench.executeCommand(CX_LOOK_SCAN);
        const input = await waitForInputBoxReady(15000);
        await safeSetText(input, EMPTY_RESULTS_SCAN_ID);
        await safeConfirm(input);
        await sleep(3000); // Wait for scan to load

        await bench.executeCommand("ast-results.createScan");

        let firstNotification = await waitForNotificationWithTimeout(5000)
        let message = await firstNotification?.getMessage();
        if (message === MESSAGES.scanProjectNotMatch) {
            let actions = await firstNotification?.getActions()
            let action = await actions[0];
            await action.click();
            firstNotification = await waitForNotificationWithTimeout(5000);
        }
        expect(firstNotification).to.not.be.undefined;
    });
});