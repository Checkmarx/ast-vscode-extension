import {
    EditorView,
    InputBox,
    VSBrowser,
    WebDriver,
    Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import {
    focusPanelAndCollapseOthers,
    getQuickPickSelector,
    initialize,
    loginWithMockToken,
    logoutIfVisible,
    retryTest,
    sleep,
} from "./utils/utils";
import {
    CX_CLEAR,
    CX_SELECT_BRANCH,
    CX_SELECT_PROJECT,
    CX_SELECT_SCAN,
    SCAN_KEY_TREE_LABEL,
    THREE_SECONDS,
    TWO_SECONDS,
} from "./utils/constants";
import { CX_TEST_SCAN_BRANCH_NAME, CX_TEST_SCAN_PROJECT_NAME } from "./utils/envs";

// TC05: all severity filter icons should be in their selected (untoggle) state by default.
// "_untoggle.svg" = filter ON, "_toggle.svg" = filter OFF.

const SUITE_SETUP_TIMEOUT_MS = 120000;
const SUITE_TEARDOWN_TIMEOUT_MS = 60000;
const TEST_TIMEOUT_MS = 60000;
const COMMAND_RETRY_DELAY_MS = 2000;

const CHECKMARX_RESULTS_PANEL_TITLE = "Checkmarx One Results";
const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

describe("Severity filter icons and vulnerability counts (TC05, TC12)", () => {
    let bench: Workbench;
    let driver: WebDriver;

    // command palette is flaky on CI - retry a few times
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

    // returns the CSS background-image URL for a severity button (tells "toggle" vs "untoggle" apart)
    async function getSeverityIconUrl(severity: string): Promise<string | undefined> {
        const section = await initialize();
        if (!section) {
            throw new Error("Cannot get the Checkmarx One Results section");
        }
        // getAction matches the button by its label (aria-label == "CRITICAL", etc.).
        const action = await section.getAction(severity);
        if (!action) {
            return undefined;
        }
        const backgroundImage = (await action.getCssValue("background-image")) ?? "";
        return backgroundImage.toLowerCase();
    }

    // opens a quick-pick, types `query` if given, and confirms the first match
    async function pickFirstQuickPickItem(command: string, query?: string): Promise<void> {
        await runCommandWithRetry(command);
        const input = await InputBox.create();
        await sleep(TWO_SECONDS); // let the quick-pick fully open before typing
        if (query) {
            await input.setText(query);
        }
        const firstItem = await getQuickPickSelector(input);
        await input.setText(firstItem);
        await input.confirm();
        await sleep(TWO_SECONDS); // let the tree react to the selection
    }

    // selects project -> branch -> scan in order
    async function loadScanResults(): Promise<void> {
        await pickFirstQuickPickItem(CX_SELECT_PROJECT, CX_TEST_SCAN_PROJECT_NAME);
        await pickFirstQuickPickItem(CX_SELECT_BRANCH, CX_TEST_SCAN_BRANCH_NAME);
        await pickFirstQuickPickItem(CX_SELECT_SCAN); // first item = latest scan
    }

    // polls until the Scan root node appears
    async function waitForScanNode(maxAttempts = 30): Promise<any> {
        let scan: any;
        for (let attempt = 0; attempt < maxAttempts && !scan; attempt++) {
            const tree = await initialize();
            scan = await tree?.findItem(SCAN_KEY_TREE_LABEL);
            if (!scan) {
                await sleep(500);
            }
        }
        expect(
            scan,
            "Scan results node should load after selecting project/branch/scan"
        ).to.not.be.undefined;
        return scan;
    }

    before(async function () {
        this.timeout(SUITE_SETUP_TIMEOUT_MS);
        bench = new Workbench();
        driver = VSBrowser.instance.driver;

        await initialize();
        // login renders the severity buttons
        await loginWithMockToken(bench, {
            executeCommandWithRetry: runCommandWithRetry,
            waitMs: THREE_SECONDS,
        });

        // blank state mirrors first-time install
        await runCommandWithRetry(CX_CLEAR);
        await sleep(TWO_SECONDS);

        // focus the panel so its toolbar buttons are visible
        await focusPanelAndCollapseOthers(CHECKMARX_RESULTS_PANEL_TITLE);
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

    it(
        "should show every severity filter icon in its selected (untoggle) state by default",
        retryTest(async function (this: Mocha.Context) {
            this.timeout(TEST_TIMEOUT_MS);

            await focusPanelAndCollapseOthers(CHECKMARX_RESULTS_PANEL_TITLE);

            for (const severity of SEVERITIES) {
                const iconUrl = await getSeverityIconUrl(severity);

                expect(
                    iconUrl,
                    `Severity button "${severity}" was not found in the results panel toolbar`
                ).to.not.be.undefined;

                // The "untoggle" icon means the filter is ON - the expected default.
                const selectedIcon = `${severity.toLowerCase()}_untoggle.svg`;
                expect(
                    iconUrl!.includes(selectedIcon),
                    `Severity "${severity}" should render the selected icon ` +
                    `("${selectedIcon}") by default, but rendered: ${iconUrl}`
                ).to.equal(true);
            }
        }, 3)
    );

    // TC12: each severity bucket under every scan type must show a non-zero count.
    // Tree layout: Scan -> engine (sast, sca, ...) -> severity -> findings
    it(
        "should display vulnerability counts for each severity level across all scan types (TC12)",
        retryTest(async function (this: Mocha.Context) {
            this.timeout(180000);

            // Select project, branch and scan so the results tree is populated.
            await loadScanResults();

            const scan = await waitForScanNode();
            await scan.expand();
            await sleep(TWO_SECONDS);

            // Direct children of the Scan node are the scan types (engines).
            const scanTypes = await scan.getChildren();
            expect(
                scanTypes.length,
                "scan should expose at least one scan type"
            ).to.be.greaterThan(0);

            for (const scanType of scanTypes) {
                const scanTypeName = (await scanType.getLabel()).trim();
                await scanType.expand();
                await sleep(TWO_SECONDS);

                // Under each scan type, the children are the severity buckets.
                const severityNodes = await scanType.getChildren();
                expect(
                    severityNodes.length,
                    `scan type "${scanTypeName}" should list severity groups`
                ).to.be.greaterThan(0);

                for (const severityNode of severityNodes) {
                    const severityName = (await severityNode.getLabel()).trim();
                    // The count is shown as the tree item description, e.g. "(7)".
                    const countText = (await severityNode.getDescription()).trim();
                    const countMatch = countText.match(/^\((\d+)\)$/);

                    expect(
                        countMatch,
                        `"${scanTypeName} > ${severityName}" should display a (count), got "${countText}"`
                    ).to.not.be.null;
                    expect(
                        Number(countMatch![1]),
                        `"${scanTypeName} > ${severityName}" count should be greater than 0`
                    ).to.be.greaterThan(0);
                }
            }
        }, 2)
    );
});
