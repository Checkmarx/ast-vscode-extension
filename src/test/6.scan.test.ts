import {
    CustomTreeSection,
    InputBox,
    VSBrowser,
    WebDriver,
    Workbench,
} from "vscode-extension-tester";
import {expect} from "chai";
import {initialize} from "./utils/utils";
import {CX_CLEAR, CX_LOOK_SCAN, VS_OPEN_FOLDER, SCAN_KEY_TREE_LABEL} from "./utils/constants";
import {waitByLinkText} from "./utils/waiters";
import {SCAN_ID} from "./utils/envs";
import {messages} from "../utils/common/messages";
import { fail } from "assert";


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

    after(async () => {
        await bench.executeCommand(CX_CLEAR);
    });

    it("should run scan from IDE", async function () {
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
        if (message === messages.scanProjectNotMatch) {
            let actions = await firstNotification?.getActions()
            let action = await actions[0];
            await action.click();
        }
        await waitForNotificationWithTimeout(5000);
    });

    it("should get wrong project notification", async function () {
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
        if (message === messages.scanProjectNotMatch) {
            let actions = await firstNotification?.getActions()
            let action = await actions[1];
            await action.click();
        } else {
          fail("Should get wrong project notification");
        }

    });
});

async function waitForNotificationWithTimeout(timeout) {
    let firstNotification;
    let isTimeout = false;

    const timer = setTimeout(() => {
        isTimeout = true;
    }, timeout);

    while (!firstNotification) {
        if (isTimeout) {
            break;
        }
        const resultsNotifications = await new Workbench().getNotifications();
        firstNotification = resultsNotifications[0];

        await sleep(100);
    }

    clearTimeout(timer);
    return firstNotification;
}

async function sleep(ms: number) {
    return await new Promise(resolve => setTimeout(resolve, ms));
}
