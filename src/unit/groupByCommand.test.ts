/* eslint-disable @typescript-eslint/no-explicit-any */
import "./mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { GroupByCommand } from "../commands/groupByCommand";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commands";
import { GroupBy, constants } from "../utils/common/constants";

describe("GroupByCommand", () => {
    let groupByCommand: GroupByCommand;
    let mockContext: vscode.ExtensionContext;
    let logs: Logs;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
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
            append: () => {},
            appendLine: () => {},
            clear: () => {},
            show: () => {},
            hide: () => {},
            dispose: () => {},
            name: "Mock Output",
            replace: () => {}
        } as vscode.OutputChannel;

        logs = new Logs(mockOutputChannel);
        sinon.stub(logs, "info");
        sinon.stub(logs, "error");
        sinon.stub(logs, "log");

        groupByCommand = new GroupByCommand(mockContext, logs);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("registerGroupBy", () => {
        it("should register all group by commands", () => {
            const registerCommandStub = sandbox.stub(vscode.commands, "registerCommand");

            groupByCommand.registerGroupBy();

            const registeredCommands = registerCommandStub.args.map(call => call[0]);
            expect(registeredCommands).to.include(commands.groupByQueryName);
            expect(registeredCommands).to.include(commands.groupByLanguage);
            expect(registeredCommands).to.include(commands.groupBySeverity);
            expect(registeredCommands).to.include(commands.groupByStatus);
            expect(registeredCommands).to.include(commands.groupByState);
            expect(registeredCommands).to.include(commands.groupByFile);
            expect(registeredCommands).to.include(commands.groupByDirectDependency);
        });
    });

    

    describe("group", () => {
        it("should update group by value and refresh tree", async () => {
            const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();

            await groupByCommand["group"](
                logs,
                mockContext,
                GroupBy.severity,
                constants.severityGroup
            );

            const updateStub = mockContext.globalState.update as sinon.SinonStub;
            expect(updateStub.args).to.deep.include([constants.severityGroup, true]);
            expect(executeCommandStub.calledWith(commands.refreshTree)).to.be.true;
        });
    });
});
