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
import { initialize, retryTest, waitForNotificationWithTimeout } from "./utils/utils";
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
        treeScans = await initialize();
        await bench.executeCommand(VS_OPEN_FOLDER);
    });

    after(async function () {
        this.timeout(30000); // Increase timeout to 30 seconds
        await bench.executeCommand(CX_CLEAR);
    });

    it("should run scan from IDE", retryTest(async function () {
        this.timeout(120000); // Increase timeout to 120 seconds for CI

        const treeScan = await initialize();
        await bench.executeCommand(CX_LOOK_SCAN);
        const input = await InputBox.create();
        // Add delay to ensure input box is ready
        await new Promise((res) => setTimeout(res, 1000));
        await input.setText(SCAN_ID);
        await input.confirm();
        await waitByLinkText(driver, SCAN_KEY_TREE_LABEL, 30000);
        let scan = await treeScan?.findItem(SCAN_KEY_TREE_LABEL);
        const maxAttempts = 60;
        let attempts = 0;
        while (scan === undefined && attempts < maxAttempts) {
            await new Promise((res) => setTimeout(res, 500));
            scan = await treeScan?.findItem(SCAN_KEY_TREE_LABEL);
            attempts++;
        }
        // click play button(or initiate scan with command)
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
