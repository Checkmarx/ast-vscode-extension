/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { GroupByCommand } from "../../commands/groupByCommand";
import { GroupBy, constants } from "../../utils/common/constants";
import { Logs } from "../../models/logs";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("GroupByCommand Tests", () => {
  let sandbox: sinon.SinonSandbox;
  let groupByCommand: GroupByCommand;
  let mockContext: vscode.ExtensionContext;
  let mockLogs: Logs;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    setExtensionConfig({
      extensionId: "test-ext",
      commandPrefix: "test",
      viewContainerPrefix: "test",
      displayName: "Test",
      extensionType: "checkmarx",
    });

    mockContext = {
      subscriptions: [],
      globalState: {
        get: sandbox.stub().returns(false),
        update: sandbox.stub().resolves(),
      } as any,
      extensionUri: vscode.Uri.parse("file:///test"),
      extensionPath: "/test",
    } as any;

    mockLogs = sinon.createStubInstance(Logs);

    groupByCommand = new GroupByCommand(mockContext, mockLogs);
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("Constructor and initialization", () => {
    it("should initialize with default active groupBy values", () => {
      const activeGroupBy = groupByCommand.activeGroupBy;
      expect(activeGroupBy).to.include(GroupBy.typeLabel);
      expect(activeGroupBy).to.include(GroupBy.scaType);
      expect(activeGroupBy).to.include(GroupBy.severity);
      expect(activeGroupBy).to.include(GroupBy.queryName);
    });

    it("should initialize with state filter set to GroupBy.state", () => {
      expect(groupByCommand.stateFilter).to.equal(GroupBy.state);
    });

    it("should store context", () => {
      expect(groupByCommand.context).to.equal(mockContext);
    });

    it("should store logs instance", () => {
      expect(groupByCommand.logs).to.equal(mockLogs);
    });
  });

  describe("getFixedGroupOrder() method (private)", () => {
    it("should return array of GroupBy values in fixed order", () => {
      const order = (groupByCommand as any).getFixedGroupOrder();
      expect(order).to.be.an("array");
      expect(order.length).to.equal(9);
    });

    it("should have typeLabel as first element", () => {
      const order = (groupByCommand as any).getFixedGroupOrder();
      expect(order[0]).to.equal(GroupBy.typeLabel);
    });

    it("should have scaType as second element", () => {
      const order = (groupByCommand as any).getFixedGroupOrder();
      expect(order[1]).to.equal(GroupBy.scaType);
    });

    it("should include all GroupBy types", () => {
      const order = (groupByCommand as any).getFixedGroupOrder();
      expect(order).to.include(GroupBy.typeLabel);
      expect(order).to.include(GroupBy.severity);
      expect(order).to.include(GroupBy.queryName);
      expect(order).to.include(GroupBy.state);
      expect(order).to.include(GroupBy.status);
      expect(order).to.include(GroupBy.language);
      expect(order).to.include(GroupBy.fileName);
      expect(order).to.include(GroupBy.directDependency);
    });
  });

  describe("toggleGroupInSet() method (private)", () => {
    it("should add group to set when include is true", () => {
      const set = new Set<GroupBy>([GroupBy.severity]);
      (groupByCommand as any).toggleGroupInSet(set, GroupBy.language, true);
      expect(set.has(GroupBy.language)).to.be.true;
    });

    it("should remove group from set when include is false", () => {
      const set = new Set<GroupBy>([GroupBy.severity, GroupBy.language]);
      (groupByCommand as any).toggleGroupInSet(set, GroupBy.language, false);
      expect(set.has(GroupBy.language)).to.be.false;
    });

    it("should not affect other items in set when adding", () => {
      const set = new Set<GroupBy>([GroupBy.severity]);
      (groupByCommand as any).toggleGroupInSet(set, GroupBy.language, true);
      expect(set.has(GroupBy.severity)).to.be.true;
    });

    it("should not affect other items in set when removing", () => {
      const set = new Set<GroupBy>([GroupBy.severity, GroupBy.language]);
      (groupByCommand as any).toggleGroupInSet(set, GroupBy.language, false);
      expect(set.has(GroupBy.severity)).to.be.true;
    });
  });

  describe("rebuildGroupByList() method (private)", () => {
    it("should return list in fixed order from set", () => {
      const set = new Set<GroupBy>([GroupBy.language, GroupBy.severity, GroupBy.queryName]);
      const order = (groupByCommand as any).getFixedGroupOrder();
      const result = (groupByCommand as any).rebuildGroupByList(set, order);

      expect(result[0]).to.equal(GroupBy.severity);
      expect(result[1]).to.equal(GroupBy.queryName);
      expect(result[2]).to.equal(GroupBy.language);
    });

    it("should exclude items not in set", () => {
      const set = new Set<GroupBy>([GroupBy.severity, GroupBy.language]);
      const order = (groupByCommand as any).getFixedGroupOrder();
      const result = (groupByCommand as any).rebuildGroupByList(set, order);

      expect(result).to.not.include(GroupBy.queryName);
    });

    it("should return empty array for empty set", () => {
      const set = new Set<GroupBy>();
      const order = (groupByCommand as any).getFixedGroupOrder();
      const result = (groupByCommand as any).rebuildGroupByList(set, order);

      expect(result).to.be.an("array");
      expect(result.length).to.equal(0);
    });

    it("should maintain fixed order even if set is unordered", () => {
      const set = new Set<GroupBy>();
      set.add(GroupBy.fileName);
      set.add(GroupBy.typeLabel);
      set.add(GroupBy.severity);

      const order = (groupByCommand as any).getFixedGroupOrder();
      const result = (groupByCommand as any).rebuildGroupByList(set, order);

      expect(result[0]).to.equal(GroupBy.typeLabel);
      expect(result[1]).to.equal(GroupBy.severity);
      expect(result[2]).to.equal(GroupBy.fileName);
    });
  });

  describe("updateResultsProviderGroup() method (private)", () => {
    it("should add groupBy when include is true", () => {
      (groupByCommand as any).updateResultsProviderGroup(GroupBy.language, true);
      expect(groupByCommand.activeGroupBy).to.include(GroupBy.language);
    });

    it("should remove groupBy when include is false", () => {
      (groupByCommand as any).updateResultsProviderGroup(GroupBy.severity, false);
      expect(groupByCommand.activeGroupBy).to.not.include(GroupBy.severity);
    });

    it("should maintain fixed order after adding", () => {
      (groupByCommand as any).updateResultsProviderGroup(GroupBy.directDependency, true);
      const activeGroupBy = groupByCommand.activeGroupBy;

      const severityIndex = activeGroupBy.indexOf(GroupBy.severity);
      const dependencyIndex = activeGroupBy.indexOf(GroupBy.directDependency);

      expect(severityIndex).to.be.lessThan(dependencyIndex);
    });

    it("should not duplicate existing groupBy", () => {
      const initialCount = groupByCommand.activeGroupBy.length;
      (groupByCommand as any).updateResultsProviderGroup(GroupBy.severity, true);

      expect(groupByCommand.activeGroupBy.length).to.equal(initialCount);
    });

    it("should handle removing last groupBy", () => {
      (groupByCommand as any).updateResultsProviderGroup(GroupBy.typeLabel, false);
      (groupByCommand as any).updateResultsProviderGroup(GroupBy.scaType, false);
      (groupByCommand as any).updateResultsProviderGroup(GroupBy.severity, false);
      (groupByCommand as any).updateResultsProviderGroup(GroupBy.queryName, false);

      expect(groupByCommand.activeGroupBy.length).to.equal(0);
    });
  });

  describe("group() method (private)", () => {
    it("should toggle groupBy on when currently off", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(false);

      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.language, constants.languageGroup);

      expect(groupByCommand.activeGroupBy).to.include(GroupBy.language);
    });

    it("should toggle groupBy off when currently on", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(true);

      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.severity, constants.severityGroup);

      expect(groupByCommand.activeGroupBy).to.not.include(GroupBy.severity);
    });

    it("should update global state with toggled value", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(false);

      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.language, constants.languageGroup);

      expect((mockContext.globalState.update as sinon.SinonStub).called).to.be.true;
    });

    it("should execute refresh tree command", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();

      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.language, constants.languageGroup);

      expect(executeCommandStub.called).to.be.true;
    });

    it("should log grouping message", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();

      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.language, constants.languageGroup);

      expect((mockLogs.info as sinon.SinonStub).called).to.be.true;
    });

    it("should handle directDependency with special message", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();

      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.directDependency, constants.dependencyGroup);

      expect((mockLogs.info as sinon.SinonStub).called).to.be.true;
    });
  });

  describe("registerGroupBy() method", () => {
    it("should register all groupBy commands", () => {
      const registerCommandStub = sandbox.stub(vscode.commands, "registerCommand").returns({
        dispose: () => {},
      } as any);

      groupByCommand.registerGroupBy();

      expect(registerCommandStub.callCount).to.be.greaterThan(0);
      expect(mockContext.subscriptions.length).to.be.greaterThan(0);
    });
  });

  describe("initializeFilters() method", () => {
    it("should load groupBy settings from global state", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.queryNameGroup).returns(false);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.languageGroup).returns(true);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.severityGroup).returns(true);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.statusGroup).returns(false);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.stateGroup).returns(false);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.fileGroup).returns(false);

      await groupByCommand.initializeFilters();

      expect((mockContext.globalState.update as sinon.SinonStub).called).to.be.true;
    });

    it("should use default values for missing settings", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(undefined);

      await groupByCommand.initializeFilters();

      expect((mockContext.globalState.update as sinon.SinonStub).called).to.be.true;
    });

    it("should refresh tree multiple times during initialization", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();

      await groupByCommand.initializeFilters();

      expect(executeCommandStub.callCount).to.be.greaterThan(1);
    });

    it("should set severity as default true", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.severityGroup).returns(undefined);

      await groupByCommand.initializeFilters();

      const updateCalls = (mockContext.globalState.update as sinon.SinonStub).getCalls();
      const severityCall = updateCalls.find(call => call.args[0] === constants.severityGroup);
      expect(severityCall?.args[1]).to.be.true;
    });
  });

  describe("GroupBy state management", () => {
    it("should correctly toggle multiple groupBys", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(false);

      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.language, constants.languageGroup);
      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.fileName, constants.fileGroup);

      expect(groupByCommand.activeGroupBy).to.include(GroupBy.language);
      expect(groupByCommand.activeGroupBy).to.include(GroupBy.fileName);
    });

    it("should maintain order when toggling", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(false);

      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.fileName, constants.fileGroup);

      const activeGroupBy = groupByCommand.activeGroupBy;
      const typeLabelIndex = activeGroupBy.indexOf(GroupBy.typeLabel);
      const fileNameIndex = activeGroupBy.indexOf(GroupBy.fileName);

      expect(typeLabelIndex).to.be.lessThan(fileNameIndex);
    });

    it("should handle removing all then re-adding", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();

      (mockContext.globalState.get as sinon.SinonStub).returns(true);
      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.typeLabel, "typeGroup");
      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.scaType, "scaType");
      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.severity, constants.severityGroup);
      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.queryName, constants.queryNameGroup);

      expect(groupByCommand.activeGroupBy.length).to.equal(0);

      (mockContext.globalState.get as sinon.SinonStub).returns(false);
      await (groupByCommand as any).group(mockLogs, mockContext, GroupBy.severity, constants.severityGroup);

      expect(groupByCommand.activeGroupBy).to.include(GroupBy.severity);
    });
  });
});
