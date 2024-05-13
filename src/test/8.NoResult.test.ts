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
import { getDetailsView, getResults, initialize } from "./utils/utils";
import { CHANGES_CONTAINER, CHANGES_LABEL, CODEBASHING_HEADER, COMMENT_BOX, CX_LOOK_SCAN, GENERAL_LABEL, LEARN_MORE_LABEL, SAST_TYPE, SCAN_KEY_TREE_LABEL, UPDATE_BUTTON, WEBVIEW_TITLE } from "./utils/constants";
import { waitByClassName } from "./utils/waiters";
import { SCAN_ID } from "./utils/envs";
import { constants } from "buffer";

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
        await input.setText("2");
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
});
