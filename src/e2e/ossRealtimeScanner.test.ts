import dotenv from "dotenv";
import {
	InputBox,
	VSBrowser,
	WebDriver,
	Workbench,
	EditorView,
	TextEditor,
	BottomBarPanel,
	MarkerType,
	SettingsEditor
} from "vscode-extension-tester";
import { expect } from "chai";
import { initialize } from "../test/utils/utils";
import {
	CX_CLEAR,
} from "../test/utils/constants";
import {
	waitForElementToAppear,
	waitForInputBoxToOpen,
	selectItem,
} from "./utils/utils";
import { constants } from "../utils/common/constants";
import * as path from "path";
import * as fsp from "fs/promises";

// Load environment variables
dotenv.config();

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

describe("OSS Scanner E2E Tests", () => {
	let bench: Workbench;
	let driver: WebDriver;
	let editorView: EditorView;

	before(async function () {
		this.timeout(120000);
		console.log("Starting OSS Scanner E2E tests setup...");
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

		await editorView.closeAllEditors();

		await initialize();
	});

	after(async () => {
		console.log("Cleaning up OSS Scanner E2E tests...");
		await bench.executeCommand(CX_CLEAR);
		await editorView.closeAllEditors();
	});

	describe("Real-time OSS Scanning E2E", () => {
		it("should scan package.json file on open and show security diagnostics", async function () {
			this.timeout(120000);

			const packageJsonPath = path.join(__dirname, "..", "resources", "menifastFiles", "package.json");

			await bench.executeCommand("workbench.action.files.openFile");
			const input = await InputBox.create();
			await input.setText(packageJsonPath);
			await input.confirm();

			await sleep(5000); 

			const editor = await editorView.openEditor("package.json") as TextEditor;
			expect(editor).to.not.be.undefined;

			const bottomBar = new BottomBarPanel();
			await bottomBar.toggle(true);
			
			const problemsView = await bottomBar.openProblemsView();
			await sleep(5000);

			const markers = await problemsView.getAllMarkers(MarkerType.Error);

			expect(markers.length).to.be.greaterThan(0, "Expected to find error markers from OSS scanner");

			const maliciousMarkers = (
				await Promise.all(markers.map(async (marker) => {
					const text = await marker.getText();
					return text.includes("Malicious package detected") ? marker : null;
				}))
			).filter(Boolean);

			const scaVulnerabilityMarkers = (
				await Promise.all(markers.map(async (marker) => {
					const text = await marker.getText();
					return text.includes("High-risk package")
				}))
			).filter(Boolean);
//add critical, high, medium

			expect(maliciousMarkers.length, "Expected to find at least one malicious package marker").to.be.greaterThan(0);
			expect(scaVulnerabilityMarkers.length, "Expected to find at least one SCA vulnerability marker").to.be.greaterThan(0);
		});

		it("should scan file on content change and generate problems", async function () {
			this.timeout(120000);
			console.log("Starting dynamic content change scan test...");

			const packageJsonPath = path.join(__dirname, "..", "resources", "menifastFiles", "package.json");
			const originalContent = await fsp.readFile(packageJsonPath, "utf8");
			console.log("Original package.json content loaded");

			await bench.executeCommand("workbench.action.files.openFile");
			const input = await InputBox.create();
			await input.setText(packageJsonPath);
			await input.confirm();

			const editor = await editorView.openEditor("package.json") as TextEditor;
			expect(editor).to.not.be.undefined;

			const bottomBar = new BottomBarPanel();
			await bottomBar.toggle(true);
			const problemsView = await bottomBar.openProblemsView();

			try {
				// Clear content to remove all issues
				console.log("Clearing package.json content...");
				await editor.setText(`{}`);
				await sleep(3000);

				let markers = await problemsView.getAllMarkers(MarkerType.Error);
				console.log(`Markers after clearing content: ${markers.length}`);
				expect(markers.length).to.equal(0, "Expected no markers with empty package.json");

				// Restore original content with vulnerabilities
				console.log("Restoring original content with vulnerabilities...");
				await editor.setText(originalContent);
				await sleep(8000); // Give more time for scanner to process

				markers = await problemsView.getAllMarkers(MarkerType.Error);
				console.log(`Markers after restoring content: ${markers.length}`);

				// Debug: Log marker texts
				const markerTexts = await Promise.all(markers.map(async (marker) => {
					return await marker.getText();
				}));
				console.log("Marker texts after restore:", markerTexts);

				expect(markers.length).to.be.greaterThan(0, "Expected markers to appear after restoring vulnerable content");

				console.log("Dynamic content change scan test completed successfully");
			} finally {
				// Ensure we restore the original content
				await editor.setText(originalContent);
				await sleep(1000);
			}
		});
	});

	describe("OSS Scanner Settings Verification", () => {
		it("should verify OSS scanner is enabled in settings", async function () {
			this.timeout(60000);
			console.log("Verifying OSS scanner settings...");

			const settingsEditor = await bench.openSettings();
			const ossCheckbox = await settingsEditor.findSetting(
				constants.activateOssRealtimeScanner,
				constants.ossRealtimeScanner
			);

			const isEnabled = await ossCheckbox.getValue();
			expect(isEnabled).to.be.true;
			console.log("OSS scanner is properly enabled in settings");

			await editorView.closeAllEditors();
		});
	});
});
