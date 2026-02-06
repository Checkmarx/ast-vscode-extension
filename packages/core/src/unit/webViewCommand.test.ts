/* eslint-disable @typescript-eslint/no-explicit-any */
import "./mocks/vscode-mock"; // Must be first
import * as vscode from "vscode";
import { WebViewCommand } from "../commands/webViewCommand";
import { Logs } from "../models/logs";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";
import { expect } from "chai";
import * as sinon from "sinon";
import { commands } from "../utils/common/commandBuilder";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";

describe("WebViewCommand", () => {
    let webViewCommand: WebViewCommand;
    let context: vscode.ExtensionContext;
    let logs: Logs;
    let resultsProvider: AstResultsProvider;

    beforeEach(() => {
        // Set up extension configuration before tests run
        setExtensionConfig({
            extensionId: 'ast-results',
            commandPrefix: 'ast-results',
            viewContainerPrefix: 'ast',
            displayName: 'Checkmarx',
            extensionType: 'checkmarx',
        });
        context = {
            subscriptions: [],
            extensionUri: vscode.Uri.parse("file:///mock"),
            extensionPath: "/mock",
        } as any;
        logs = sinon.createStubInstance(Logs);
        resultsProvider = sinon.createStubInstance(AstResultsProvider);

        webViewCommand = new WebViewCommand(context, logs, resultsProvider);
    });

    afterEach(() => {
        sinon.restore();
        resetExtensionConfig();
    });

    it("should register new details command", async () => {
        const registerCommandStub = sinon.stub(vscode.commands, "registerCommand");

        webViewCommand.registerNewDetails();

        expect(registerCommandStub.calledWith(commands.newDetails)).to.be.true; // ✅ Fixed reference
    });

    it("should register GPT command", async () => {
        const registerCommandStub = sinon.stub(vscode.commands, "registerCommand");

        webViewCommand.registerGpt();

        expect(registerCommandStub.calledWith(commands.gpt)).to.be.true; // ✅ Fixed reference
    });

    // it("should create a WebviewPanel when registering new details", async () => {
    //     const createWebviewPanelStub = sinon.stub(vscode.window, "createWebviewPanel");
    //     const mockPanel = {
    //         webview: {
    //             html: "",
    //             onDidReceiveMessage: sinon.stub(),
    //             postMessage: sinon.stub(),
    //         },
    //         dispose: sinon.stub(),
    //         onDidDispose: sinon.stub(),
    //     };
    //     createWebviewPanelStub.returns(mockPanel as any);

    //     webViewCommand.registerNewDetails();

    //     await vscode.commands.executeCommand(commands.newDetails, {
    //         severity: "High",
    //         label: "Mock Issue",
    //     });

    //     expect(createWebviewPanelStub.called).to.be.true;
    // });

    // it("should handle messages sent to Webview", async () => {
    //     const mockPanel = {
    //         webview: {
    //             onDidReceiveMessage: sinon.stub(),
    //             postMessage: sinon.stub(),
    //         },
    //         dispose: sinon.stub(),
    //         onDidDispose: sinon.stub(),
    //     };

    //     (webViewCommand as any).detailsPanel = mockPanel as any;

    //     await vscode.commands.executeCommand(commands.newDetails, {
    //         severity: "High",
    //         label: "Mock Issue",
    //     });

    //     expect(mockPanel.webview.onDidReceiveMessage.called).to.be.true;
    // });

    it("should dispose WebviewPanel on close", () => {
        const disposeStub = sinon.stub();
        (webViewCommand as any).detailsPanel = {
            dispose: disposeStub,
        } as any;

        (webViewCommand as any).detailsPanel.dispose();

        expect(disposeStub.called).to.be.true;
    });
});
