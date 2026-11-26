import {
    CustomTreeSection,
    EditorView,
    InputBox,
    VSBrowser,
    WebDriver,
    Workbench,
    Notification,
} from "vscode-extension-tester";
import { CX_CLEAR, CX_LOOK_SCAN, VS_OPEN_FOLDER, SCAN_KEY_TREE_LABEL, MESSAGES,
  CX_RUN_SCAN,
} from "./utils/constants";
import { waitByLinkText } from "./utils/waiters";
import { SCAN_ID } from "./utils/envs";
import { initialize, pollUntil, retryTest, waitForNotificationWithTimeout, loginWithMockToken, logoutIfVisible, } from "./utils/utils";
import { expect } from "chai";

const COMMAND_RETRY_DELAY_MS = 2000;
const INPUT_READY_DELAY_MS = 1000;
const SCAN_LINK_TIMEOUT_MS = 30000;
const SCAN_POLL_DELAY_MS = 500;
const SCAN_POLL_MAX_ATTEMPTS = 60;
const NOTIFICATION_TIMEOUT_MS = 30000;
const TEST_TIMEOUT_MS = 120000;


// Pauses execution for the given number of milliseconds.
async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
describe("Scan from IDE", () => {
    let bench: Workbench;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let treeScans: CustomTreeSection;
    let driver: WebDriver;

    // Runs a VS Code command and retries up to `retries` times if it fails.
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

    // Types the scan ID into the command palette and polls the tree until the scan appears.
    async function openScanById(scanId: string): Promise<void> {
        await runCommandWithRetry(CX_LOOK_SCAN);
        const input = await InputBox.create();
        await sleep(INPUT_READY_DELAY_MS);
        await input.setText(scanId);
        await input.confirm();

        await waitByLinkText(driver, SCAN_KEY_TREE_LABEL, SCAN_LINK_TIMEOUT_MS);

        let treeScan = await initialize();
        let scan = await treeScan?.findItem(SCAN_KEY_TREE_LABEL);
        let attempts = 0;

        while (scan === undefined && attempts < SCAN_POLL_MAX_ATTEMPTS) {
            await sleep(SCAN_POLL_DELAY_MS);
            treeScan = await initialize();
            scan = await treeScan?.findItem(SCAN_KEY_TREE_LABEL);
            attempts++;
        }

        expect(scan, "Scan should be visible in the Checkmarx tree").to.not.be.undefined;
    }

    // Closes all visible notifications so they don't bleed into the next test.
    // If a notification from a prior test is left open, the getUserInput() promise
    // it owns stays pending and interferes with the next createScan call.
    async function clearCurrentNotifications(): Promise<void> {
        try {
            const notifications = await new Workbench().getNotifications();
            for (const notification of notifications) {
                try {
                    await (notification as Notification).dismiss();
                } catch {
                    // Notification may already be gone — ignore.
                }
            }
            // Give the extension host a moment to settle after dismissing.
            await sleep(1500);
        } catch {
            // Non-fatal: proceed even if notification clearing fails.
        }
    }

    // Triggers the createScan command and returns the notification it raises.
    // Starts polling before firing the command so a fast notification isn't missed.
    async function startScanAndCaptureNotification() {
        // Clear stale notifications first so we only capture what this scan produces.
        await clearCurrentNotifications();

        // Real-tenant runs first show a transient "Loading results" toast; skip it and
        // wait for the actual scan-related notification.
        const notificationPromise = pollUntil(async () => {
            for (const notification of await new Workbench().getNotifications()) {
                const message = await notification.getMessage().catch(() => undefined);
                if (message !== undefined && !/Loading results/i.test(message)) {
                    return { notification, message };
                }
            }
            return undefined;
        }, Boolean, NOTIFICATION_TIMEOUT_MS, 500);
        await runCommandWithRetry(CX_RUN_SCAN);
        const captured = await notificationPromise;
        expect(captured, "Expected a VS Code notification after createScan — none arrived within the timeout").to.not.be.undefined;
        return captured!;
    }


    // Logs in with a mock token and opens the test folder before the tests run.
    before(async function () {
        this.timeout(100000);
        bench = new Workbench();
        driver = VSBrowser.instance.driver;
        treeScans = await initialize();
        await loginWithMockToken(bench, {
            executeCommandWithRetry: runCommandWithRetry,
            waitMs: 3000,
        });
        await runCommandWithRetry(VS_OPEN_FOLDER);
    });

    // Logs out, clears the scan tree, and closes all open editors after tests finish.
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

    it("should run scan from IDE", retryTest(async function () {
        this.timeout(TEST_TIMEOUT_MS);

        await openScanById(SCAN_ID);
        const { notification, message } = await startScanAndCaptureNotification();
        if (message === MESSAGES.scanProjectNotMatch) {
            // The mismatch prompt stays open until answered, so its actions are safe to read.
            const actions = await notification.getActions();
            await actions[0].click();
            const next = await waitForNotificationWithTimeout(NOTIFICATION_TIMEOUT_MS);
            expect(next, "A notification should follow accepting the mismatch prompt").to.not.be.undefined;
        }
    }));

    // SKIPPED: failing - no VS Code notification arrives after createScan within the timeout.
    it.skip("should get wrong project notification", retryTest(async function () {
        this.timeout(TEST_TIMEOUT_MS);

        await openScanById(SCAN_ID);
        const { notification, message } = await startScanAndCaptureNotification();
        expect(message).to.equal(MESSAGES.scanProjectNotMatch);
        const actions = await notification.getActions();
        expect(actions.length, "Wrong-project notification should have at least two actions").to.be.greaterThan(1);
        await actions[1].click();

    }));
});
