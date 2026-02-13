/* eslint-disable @typescript-eslint/no-explicit-any */
import "./mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { PickerCommand } from "../commands/pickerCommand";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commandBuilder";
// import { projectPicker, branchPicker, scanPicker, scanInput } from "../utils/pickers/pickers";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";

describe("PickerCommand", () => {
    let pickerCommand: PickerCommand;
    let mockContext: vscode.ExtensionContext;
    let logs: Logs;
    let sandbox: sinon.SinonSandbox;
    let resultsProvider: AstResultsProvider;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Set up extension configuration before tests run
        setExtensionConfig({
            extensionId: 'ast-results',
            commandPrefix: 'ast-results',
            viewContainerPrefix: 'ast',
            displayName: 'Checkmarx',
            extensionType: 'checkmarx',
        });
        mockContext = {
            subscriptions: [],
            globalState: {
                get: sinon.stub(),
                update: sinon.stub().resolves(),
            },
            extensionUri: vscode.Uri.file("/mock/path"),
            extensionPath: "/mock/path"
        } as any;

        const mockOutputChannel = {
            append: () => { },
            appendLine: () => { },
            clear: () => { },
            show: () => { },
            hide: () => { },
            dispose: () => { },
            name: "Mock Output",
            replace: () => { }
        } as vscode.OutputChannel;

        logs = new Logs(mockOutputChannel);
        sinon.stub(logs, "info");
        sinon.stub(logs, "error");
        sinon.stub(logs, "log");

        resultsProvider = {} as AstResultsProvider;
        pickerCommand = new PickerCommand(mockContext, logs, resultsProvider, false);
    });

    afterEach(() => {
        sandbox.restore();
        resetExtensionConfig();
    });

    describe("registerPickerCommands", () => {
        it("should register all picker commands", () => {
            const registerCommandStub = sandbox.stub(vscode.commands, "registerCommand");

            pickerCommand.registerPickerCommands();

            expect(registerCommandStub.calledWith(commands.generalPick)).to.be.true;
            expect(registerCommandStub.calledWith(commands.projectPick)).to.be.true;
            expect(registerCommandStub.calledWith(commands.branchPick)).to.be.true;
            expect(registerCommandStub.calledWith(commands.scanPick)).to.be.true;
            expect(registerCommandStub.calledWith(commands.scanInput)).to.be.true;
        });
    });

    describe("projectPicker", () => {
        // it("should call projectPicker function", async () => {
        //     const projectPickerStub = sandbox.stub().resolves();
        //     sandbox.stub(vscode.commands, "registerCommand").callsFake((command, callback) => {
        //         if (command === commands.projectPick) {
        //             callback();
        //         }
        //         return {} as vscode.Disposable;
        //     });

        //     // sandbox.stub(projectPicker, "default").returns(Promise.resolve());

        //     await pickerCommand.registerPickerCommands();

        //     expect(projectPickerStub.calledOnce).to.be.true;
        // });
    });

    describe("branchPicker", () => {
        // it("should call branchPicker function", async () => {
        //     const branchPickerStub = sandbox.stub().resolves();
        //     sandbox.stub(vscode.commands, "registerCommand").callsFake((command, callback) => {
        //         if (command === commands.branchPick) {
        //             callback();
        //         }
        //         return {} as vscode.Disposable;
        //     });

        //     // sandbox.stub(branchPicker).resolves();

        //     await pickerCommand.registerPickerCommands();

        //     expect(branchPickerStub.calledOnce).to.be.true;
        // });
    });

    describe("scanPicker", () => {
        // it("should call scanPicker function", async () => {
        //     const scanPickerStub = sandbox.stub().resolves();
        //     sandbox.stub(vscode.commands, "registerCommand").callsFake((command, callback) => {
        //         if (command === commands.scanPick) {
        //             callback();
        //         }
        //         return {} as vscode.Disposable;
        //     });

        //     // sandbox.stub(scanPicker).resolves();

        //     await pickerCommand.registerPickerCommands();

        //     expect(scanPickerStub.calledOnce).to.be.true;
        // });
    });

    describe("scanInput", () => {
        // it("should call scanInput function", async () => {
        //     const scanInputStub = sandbox.stub().resolves();
        //     sandbox.stub(vscode.commands, "registerCommand").callsFake((command, callback) => {
        //         if (command === commands.scanInput) {
        //             callback();
        //         }
        //         return {} as vscode.Disposable;
        //     });

        //     // sandbox.stub(scanInput).resolves();

        //     await pickerCommand.registerPickerCommands();

        //     expect(scanInputStub.calledOnce).to.be.true;
        // });
    });
});
