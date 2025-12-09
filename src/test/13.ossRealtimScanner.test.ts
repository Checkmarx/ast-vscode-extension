import {
    InputBox,
    VSBrowser,
    WebDriver,
    Workbench,
    EditorView,
    TextEditor,
    BottomBarPanel,
    MarkerType
} from "vscode-extension-tester";
import { 
    CX_CLEAR, 
    VS_OPEN_FOLDER,
} from "./utils/constants";
import { retryTest } from "./utils/utils";
import { expect } from "chai";
import * as path from "path";
import * as fsp from "fs/promises";
import { constants } from "../utils/common/constants";

describe("OSS Scanner Tests", () => {
    let bench: Workbench;
    let driver: WebDriver;
    let editorView: EditorView;

    before(async function () {
        this.timeout(100000);
        bench = new Workbench();
        driver = VSBrowser.instance.driver;
        editorView = new EditorView();
        
        // Enable OSS realtime scanner in settings
        const settingsEditor = await bench.openSettings();
        const ossCheckbox = await settingsEditor.findSetting(
            constants.activateOssRealtimeScanner,
            constants.ossRealtimeScanner
        );
        await ossCheckbox.setValue(true);
        console.log(ossCheckbox);
        // Close settings by closing all editors
        await editorView.closeAllEditors();
        
        await bench.executeCommand(VS_OPEN_FOLDER);
		this.timeout(30000);
    });

    after(async () => {
        await bench.executeCommand(CX_CLEAR);
        await editorView.closeAllEditors();
    });

    describe("Real-time OSS Scanning", () => {
        it("should scan package.json file on open and show malicious package diagnostics", retryTest(async function () {

            const packageJsonPath = path.join(__dirname, "menifastFiles", "package.json");
            await bench.executeCommand("workbench.action.files.openFile");
            const input = await InputBox.create();
            await input.setText(packageJsonPath);
            await input.confirm();

            await driver.sleep(3000);

            const editor = await editorView.openEditor("package.json") as TextEditor;
            expect(editor).to.not.be.undefined;

            const bottomBar = new BottomBarPanel();
            await bottomBar.toggle(true);
            const problemsView = await bottomBar.openProblemsView();

            await driver.sleep(2000);

            const markers = await problemsView.getAllMarkers(MarkerType.Error);
            expect(markers.length).to.be.greaterThan(0);
		    const maliciousMarkers = (
                await Promise.all(markers.map(async (marker) => {
                    const text = await marker.getText();
                    return text.includes("Malicious package detected") ? marker : null;
                }))
            ).filter(Boolean);

            const scaVulnerabilityMarkers = (
                await Promise.all(markers.map(async (marker) => {
                    const text = await marker.getText();
                    return text.includes("High-risk package") || text.includes("vulnerability detected") ? marker : null;
                }))
            ).filter(Boolean);

            expect(maliciousMarkers.length).to.be.greaterThan(0);
            expect(scaVulnerabilityMarkers.length).to.be.greaterThan(0);
       
		}));

        it.skip("should scan file on content change and generate problems", retryTest(async function () {
            const packageJsonPath = path.join(__dirname, "menifastFiles", "package.json");

            const originalContent = await fsp.readFile(packageJsonPath, "utf8");

            await bench.executeCommand("workbench.action.files.openFile");
            const input = await InputBox.create();
            await input.setText(packageJsonPath);
            await input.confirm();

            const editor = await editorView.openEditor("package.json") as TextEditor;

            await bench.executeCommand("workbench.actions.view.problems");

            try {
                await editor.setText(`{}`);
                await driver.sleep(2000);

                const bottomBar = new BottomBarPanel();
                await bottomBar.toggle(true);
                const problemsView = await bottomBar.openProblemsView();

                await driver.sleep(2000);

                let markers = await problemsView.getAllMarkers(MarkerType.Error);
                expect(markers.length).to.equal(0);

                await editor.setText(originalContent);
                await driver.sleep(5000); 

                markers = await problemsView.getAllMarkers(MarkerType.Error);
                expect(markers.length).to.be.greaterThan(0);

                await driver.sleep(1000);
            } finally {
                await editor.setText(originalContent);
            }
        }));
    });
})
