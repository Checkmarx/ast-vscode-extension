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
    });

    after(async () => {
        await new EditorView().closeAllEditors();
    });

    it("should load results from scan ID", async function () {
        this.timeout(60000); // Increase timeout to 60 seconds

        await bench.executeCommand(CX_LOOK_SCAN);
        let input = await new InputBox();
        // Add delay to ensure input box is ready
        await new Promise((res) => setTimeout(res, 1000));
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

        await bench.executeCommand(CX_LOOK_SCAN);
        const input = await InputBox.create();
        // Add delay to ensure input box is ready
        await new Promise((res) => setTimeout(res, 1000));
        await input.setText(EMPTY_RESULTS_SCAN_ID);
        await input.confirm();

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