import {
    EditorView,
    Notification,
    VSBrowser,
    WebDriver,
    Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
    initialize,
    loginWithMockToken,
    logoutIfVisible,
    retryTest,
    sleep,
    waitForNotificationWithTimeout,
} from "./utils/utils";
import {
    CX_CLEAR,
    CX_SELECT_BRANCH,
    CX_SELECT_SCAN,
    MESSAGES,
    TEN_SECONDS,
    THREE_SECONDS,
    TWO_SECONDS,
} from "./utils/constants";

const SUITE_SETUP_TIMEOUT_MS = 120000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 60000;
const COMMAND_RETRY_DELAY_MS = 2000;

describe("Edit icon error messages when selections are missing", () => {
    let bench: Workbench;
    let driver: WebDriver;

    // command palette is flaky on slow machines - retry a few times
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

    // clear stale toasts so we don't accidentally pick up a leftover notification
    async function clearCurrentNotifications(): Promise<void> {
        try {
            const notifications = await new Workbench().getNotifications();
            for (const notification of notifications) {
                try {
                    await (notification as Notification).dismiss();
                } catch {
                    // already gone, fine
                }
            }
            await sleep(TWO_SECONDS);
        } catch {
            // don't fail the test just because cleanup hiccuped
        }
    }

    before(async function () {
        this.timeout(SUITE_SETUP_TIMEOUT_MS);
        bench = new Workbench();
        driver = VSBrowser.instance.driver;
        await initialize();
        await loginWithMockToken(bench, {
            executeCommandWithRetry: runCommandWithRetry,
            waitMs: THREE_SECONDS,
        });
        // tests need a blank state - no project/branch/scan
        await runCommandWithRetry(CX_CLEAR);
        await sleep(TWO_SECONDS);
    });

    after(async function () {
        this.timeout(SUITE_TEARDOWN_TIMEOUT_MS);
        try {
            await logoutIfVisible(bench, driver, {
                executeCommandWithRetry: runCommandWithRetry,
            });
        } catch {
            // best effort on teardown
        }
        await runCommandWithRetry(CX_CLEAR);
        await new EditorView().closeAllEditors();
    });

    // same as clicking the Branch edit icon, easier to drive via command palette
    it("should display error when clicking edit icon for branch without selecting a project",
        retryTest(async function () {
            this.timeout(TEST_TIMEOUT_MS);

            await clearCurrentNotifications();

            // start watching BEFORE firing - the toast can vanish fast
            const notificationPromise = waitForNotificationWithTimeout(TEN_SECONDS);
            await runCommandWithRetry(CX_SELECT_BRANCH);
            const notification = await notificationPromise;

            expect(
                notification,
                "no error toast appeared after Select Branch was triggered"
            ).to.not.be.undefined;

            const message = await notification?.getMessage();
            expect(message).to.equal(MESSAGES.pickerProjectMissing);
        }, 3));

    // when both project AND branch are missing
    it("should display error when clicking edit icon for scan without selecting a project and branch",
        retryTest(async function () {
            this.timeout(TEST_TIMEOUT_MS);

            // CX_CLEAR is cheap insurance even though the previous test left it blank
            await runCommandWithRetry(CX_CLEAR);
            await sleep(TWO_SECONDS);
            await clearCurrentNotifications();

            const notificationPromise = waitForNotificationWithTimeout(TEN_SECONDS);
            await runCommandWithRetry(CX_SELECT_SCAN);
            const notification = await notificationPromise;

            expect(
                notification,
                "no error toast appeared after Select Scan was triggered"
            ).to.not.be.undefined;

            const message = await notification?.getMessage();
            expect(message).to.equal(MESSAGES.pickerBranchProjectMissing);
        }, 3));
});
