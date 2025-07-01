import {
    By,
    CustomTreeSection,
    EditorView,
    InputBox,
    VSBrowser,
    WebDriver,
    Workbench,
} from "vscode-extension-tester";
import { expect } from "chai";
import { getDetailsView, getResults, initialize, waitForNotificationWithTimeout } from "./utils/utils";
import { CHANGES_CONTAINER, CHANGES_LABEL, CODEBASHING_HEADER, COMMENT_BOX, CX_LOOK_SCAN, GENERAL_LABEL, LEARN_MORE_LABEL, SAST_TYPE, SCAN_KEY_TREE_LABEL, UPDATE_BUTTON, WEBVIEW_TITLE } from "./utils/constants";
import { waitByClassName } from "./utils/waiters";
import { EMPTY_RESULTS_SCAN_ID, SCAN_ID } from "./utils/envs";
import { constants } from "buffer";
import { messages } from "../utils/common/messages";

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
        await bench.executeCommand(CX_LOOK_SCAN);
        let input = await new InputBox();
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
        let scanResults = await scanChildren[0].getChildren();
        expect(scanResults).not.to.be.undefined;
        expect(scanResults.length).to.be.equal(0);
	});
    it("should allow creating a new scan even if the current scan has zero results", async function () {
        
        await bench.executeCommand(CX_LOOK_SCAN);
        const input = await InputBox.create();
        await input.setText(EMPTY_RESULTS_SCAN_ID);
        await input.confirm();
        
        await bench.executeCommand("ast-results.createScan");

 let firstNotification = await waitForNotificationWithTimeout(5000)
        let message = await firstNotification?.getMessage();
        if (message === messages.scanProjectNotMatch) {
            let actions = await firstNotification?.getActions()
            let action = await actions[0];
            await action.click();
            firstNotification = await waitForNotificationWithTimeout(5000);
        }
        expect(firstNotification).to.not.be.undefined;
    }); 
});
