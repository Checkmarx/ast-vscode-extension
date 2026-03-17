import {
    CustomTreeSection,
    EditorView,
    InputBox,
    VSBrowser,
    WebDriver,
    Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
    initialize,
    waitForNotificationWithTimeout,
    validateRootNodeBool,
    loginWithMockToken,
    logoutIfVisible,
} from "./utils/utils";
import { CX_CLEAR, CX_LOOK_SCAN, SCAN_KEY_TREE_LABEL, MESSAGES } from "./utils/constants";
import { EMPTY_RESULTS_SCAN_ID } from "./utils/envs";

const COMMAND_RETRY_DELAY_MS = 2000;

// Small delay helper used between retries and UI waits.
async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Scan ID load results test", () => {
    let bench: Workbench;
    let treeScans: CustomTreeSection;
    let driver: WebDriver;

    // Runs VS Code commands with retry to reduce transient test flakiness.
    async function runCommandWithRetry(command: string, retries = 3): Promise<void> {
        let lastError: unknown;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await bench.executeCommand(command);
                return;
            } catch (error) {
                lastError = error;
                if (attempt < retries) {
                    await sleep(COMMAND_RETRY_DELAY_MS);
                }
            }
        }
        throw lastError;
    }

    before(async function () {
        this.timeout(100000);
        bench = new Workbench();
        driver = VSBrowser.instance.driver;

        // Authenticate once for this suite before executing scan commands.
        await initialize();
        await loginWithMockToken(bench, {
            executeCommandWithRetry: runCommandWithRetry,
            waitMs: 3000,
        });
        await runCommandWithRetry(CX_CLEAR);
    });

    after(async function () {
        this.timeout(60000);
        try {
            await logoutIfVisible(bench, driver, {
                executeCommandWithRetry: runCommandWithRetry,
            });
        } catch {
            // Keep teardown resilient.
        }
        await runCommandWithRetry(CX_CLEAR);
        await new EditorView().closeAllEditors();
    });

    it("should load results from scan ID", async function () {
        this.timeout(60000); // Increase timeout to 60 seconds

        await runCommandWithRetry(CX_LOOK_SCAN);
        let input = await new InputBox();
        // Add delay to ensure input box is ready
        await sleep(1000);
        await input.setText("e3b2505a-0634-4b41-8fa1-dfeb2edc26f7");
        await input.confirm();
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
        this.timeout(60000); // Increase timeout to 60 seconds

        await runCommandWithRetry(CX_LOOK_SCAN);
        const input = await InputBox.create();
        // Add delay to ensure input box is ready
        await sleep(1000);
        await input.setText(EMPTY_RESULTS_SCAN_ID);
        await input.confirm();

        await runCommandWithRetry("ast-results.createScan");

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