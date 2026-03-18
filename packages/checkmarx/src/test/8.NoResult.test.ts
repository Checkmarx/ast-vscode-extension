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

    // Loads a known scan by ID to populate the results tree for subsequent assertions.
    it("should load results from scan ID", async function () {
        this.timeout(60000);

        await runCommandWithRetry(CX_LOOK_SCAN);
        let input = await new InputBox();
        await sleep(1000);
        // Fixed scan ID used as a stable fixture with known non-empty results.
        await input.setText("e3b2505a-0634-4b41-8fa1-dfeb2edc26f7");
        await input.confirm();
    });

    // Verifies the scan root node is present and expandable after loading results.
    it("should check scan result is not undefined", async function () {
        treeScans = await initialize();
        while (treeScans === undefined) {
            treeScans = await initialize();
        }
        let scan = await treeScans?.findItem(SCAN_KEY_TREE_LABEL);
        await scan?.expand();
        // scanChildren is expanded but not asserted — expand ensures the node is interactive.
        let scanChildren = await scan?.getChildren();
        const isValidated = await validateRootNodeBool(scan);
        expect(isValidated).to.equal(true);
    });

    // Confirms a new scan can be triggered even when the currently loaded scan has zero findings.
    it("should allow creating a new scan even if the current scan has zero results", async function () {
        this.timeout(60000);

        // Load a scan that returns zero results to exercise the empty-state code path.
        await runCommandWithRetry(CX_LOOK_SCAN);
        const input = await InputBox.create();
        await sleep(1000);
        await input.setText(EMPTY_RESULTS_SCAN_ID);
        await input.confirm();

        await runCommandWithRetry("ast-results.createScan");

        // If the git project does not match the CX project, confirm the mismatch dialog.
        let firstNotification = await waitForNotificationWithTimeout(5000);
        let message = await firstNotification?.getMessage();
        if (message === MESSAGES.scanProjectNotMatch) {
            let actions = await firstNotification?.getActions();
            let action = await actions[0];
            await action.click();
            firstNotification = await waitForNotificationWithTimeout(5000);
        }
        expect(firstNotification).to.not.be.undefined;
    });
});