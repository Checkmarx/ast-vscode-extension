/* eslint-disable @typescript-eslint/no-explicit-any */
import "./mocks/vscode-mock"; // Must be first
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { FilterCommand } from "../commands/filterCommand";
import { Logs } from "../models/logs";
// import { SeverityLevel, StateLevel, constants } from "../utils/common/constants";
import { commands } from "../utils/common/commandBuilder";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";

describe("FilterCommand", () => {
    let filterCommand: FilterCommand;
    let mockContext: vscode.ExtensionContext;
    let logs: Logs;
    let sandbox: sinon.SinonSandbox;

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

        filterCommand = new FilterCommand(mockContext, logs);
    });

    afterEach(() => {
        sandbox.restore();
        resetExtensionConfig();
    });




    describe("registerFilters", () => {
        it("should register all filter commands", () => {
            const registerCommandStub = sandbox.stub(vscode.commands, "registerCommand");

            filterCommand.registerFilters();

            const registeredCommands = registerCommandStub.args.map(call => call[0]);
            expect(registeredCommands).to.include(commands.filterCritical);
            expect(registeredCommands).to.include(commands.filterHigh);
            expect(registeredCommands).to.include(commands.filterMedium);
            expect(registeredCommands).to.include(commands.filterLow);
            expect(registeredCommands).to.include(commands.filterInfo);
            expect(registeredCommands).to.include(commands.filterNotExploitable);
            expect(registeredCommands).to.include(commands.filterProposed);
            expect(registeredCommands).to.include(commands.filterConfirmed);
            expect(registeredCommands).to.include(commands.filterToVerify);
            expect(registeredCommands).to.include(commands.filterUrgent);
            expect(registeredCommands).to.include(commands.filterNotIgnored);
            expect(registeredCommands).to.include(commands.filterIgnored);
            expect(registeredCommands).to.include(commands.filterSCAHideDevTest);
            expect(registeredCommands).to.include(commands.filterAllCustomStates);
        });
    });
}); 