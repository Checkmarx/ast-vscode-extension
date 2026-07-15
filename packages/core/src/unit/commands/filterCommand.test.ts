/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { FilterCommand } from "../../commands/filterCommand";
import { SeverityLevel, StateLevel, constants } from "../../utils/common/constants";
import { Logs } from "../../models/logs";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("FilterCommand Tests", () => {
  let sandbox: sinon.SinonSandbox;
  let filterCommand: FilterCommand;
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
        get: sandbox.stub().returns(true),
        update: sandbox.stub().resolves(),
      } as any,
      extensionUri: vscode.Uri.parse("file:///test"),
      extensionPath: "/test",
    } as any;

    mockLogs = sinon.createStubInstance(Logs);

    filterCommand = new FilterCommand(mockContext, mockLogs);
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("Constructor and initialization", () => {
    it("should initialize with default active severities", () => {
      const severities = filterCommand.getAtiveSeverities();
      expect(severities).to.include(SeverityLevel.critical);
      expect(severities).to.include(SeverityLevel.high);
      expect(severities).to.include(SeverityLevel.medium);
      expect(severities.length).to.equal(3);
    });

    it("should initialize with default active states", () => {
      const states = filterCommand.getActiveStates();
      expect(states).to.include(StateLevel.confirmed);
      expect(states).to.include(StateLevel.toVerify);
      expect(states).to.include(StateLevel.urgent);
      expect(states).to.include(StateLevel.notIgnored);
      expect(states.length).to.equal(4);
    });

    it("should store context", () => {
      expect(filterCommand.context).to.equal(mockContext);
    });

    it("should store logs instance", () => {
      expect(filterCommand.logs).to.equal(mockLogs);
    });
  });

  describe("getAtiveSeverities() method", () => {
    it("should return array of active severities", () => {
      const severities = filterCommand.getAtiveSeverities();
      expect(severities).to.be.an("array");
    });

    it("should return default three severities", () => {
      const severities = filterCommand.getAtiveSeverities();
      expect(severities).to.have.lengthOf(3);
    });

    it("should include critical, high, and medium by default", () => {
      const severities = filterCommand.getAtiveSeverities();
      expect(severities).to.include(SeverityLevel.critical);
      expect(severities).to.include(SeverityLevel.high);
      expect(severities).to.include(SeverityLevel.medium);
    });
  });

  describe("getActiveStates() method", () => {
    it("should return array of active states", () => {
      const states = filterCommand.getActiveStates();
      expect(states).to.be.an("array");
    });

    it("should return default four states", () => {
      const states = filterCommand.getActiveStates();
      expect(states).to.have.lengthOf(4);
    });

    it("should include confirmed, toVerify, urgent, and notIgnored by default", () => {
      const states = filterCommand.getActiveStates();
      expect(states).to.include(StateLevel.confirmed);
      expect(states).to.include(StateLevel.toVerify);
      expect(states).to.include(StateLevel.urgent);
      expect(states).to.include(StateLevel.notIgnored);
    });
  });

  describe("updateSeverities() method (private)", () => {
    it("should add severity when include is true and severity is not present", async () => {
      const initialCount = filterCommand.getAtiveSeverities().length;
      (filterCommand as any).updateSeverities(SeverityLevel.low, true);

      const severities = filterCommand.getAtiveSeverities();
      expect(severities).to.include(SeverityLevel.low);
      expect(severities.length).to.equal(initialCount + 1);
    });

    it("should not add severity when it already exists", async () => {
      const initialCount = filterCommand.getAtiveSeverities().length;
      (filterCommand as any).updateSeverities(SeverityLevel.critical, true);

      const severities = filterCommand.getAtiveSeverities();
      expect(severities.length).to.equal(initialCount);
    });

    it("should remove severity when include is false and severity is present", async () => {
      const initialCount = filterCommand.getAtiveSeverities().length;
      (filterCommand as any).updateSeverities(SeverityLevel.critical, false);

      const severities = filterCommand.getAtiveSeverities();
      expect(severities).to.not.include(SeverityLevel.critical);
      expect(severities.length).to.equal(initialCount - 1);
    });

    it("should not affect array when removing non-existent severity", async () => {
      const initialCount = filterCommand.getAtiveSeverities().length;
      (filterCommand as any).updateSeverities(SeverityLevel.low, false);

      const severities = filterCommand.getAtiveSeverities();
      expect(severities.length).to.equal(initialCount);
    });

    it("should handle multiple add/remove operations", async () => {
      (filterCommand as any).updateSeverities(SeverityLevel.low, true);
      (filterCommand as any).updateSeverities(SeverityLevel.info, true);
      (filterCommand as any).updateSeverities(SeverityLevel.critical, false);

      const severities = filterCommand.getAtiveSeverities();
      expect(severities).to.include(SeverityLevel.low);
      expect(severities).to.include(SeverityLevel.info);
      expect(severities).to.not.include(SeverityLevel.critical);
    });
  });

  describe("updateState() method (private)", () => {
    it("should add state when include is true and state is not present", async () => {
      const initialCount = filterCommand.getActiveStates().length;
      (filterCommand as any).updateState(StateLevel.proposed, true);

      const states = filterCommand.getActiveStates();
      expect(states).to.include(StateLevel.proposed);
      expect(states.length).to.equal(initialCount + 1);
    });

    it("should not add state when it already exists", async () => {
      const initialCount = filterCommand.getActiveStates().length;
      (filterCommand as any).updateState(StateLevel.confirmed, true);

      const states = filterCommand.getActiveStates();
      expect(states.length).to.equal(initialCount);
    });

    it("should remove state when include is false and state is present", async () => {
      const initialCount = filterCommand.getActiveStates().length;
      (filterCommand as any).updateState(StateLevel.confirmed, false);

      const states = filterCommand.getActiveStates();
      expect(states).to.not.include(StateLevel.confirmed);
      expect(states.length).to.equal(initialCount - 1);
    });

    it("should not affect array when removing non-existent state", async () => {
      const initialCount = filterCommand.getActiveStates().length;
      (filterCommand as any).updateState(StateLevel.notExploitable, false);

      const states = filterCommand.getActiveStates();
      expect(states.length).to.equal(initialCount);
    });

    it("should handle multiple add/remove operations on states", async () => {
      (filterCommand as any).updateState(StateLevel.proposed, true);
      (filterCommand as any).updateState(StateLevel.notExploitable, true);
      (filterCommand as any).updateState(StateLevel.confirmed, false);

      const states = filterCommand.getActiveStates();
      expect(states).to.include(StateLevel.proposed);
      expect(states).to.include(StateLevel.notExploitable);
      expect(states).to.not.include(StateLevel.confirmed);
    });
  });

  describe("filter() method (private)", () => {
    it("should toggle severity filter on", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(false);

      await (filterCommand as any).filter(mockLogs, mockContext, SeverityLevel.critical, constants.criticalFilter);

      expect(filterCommand.getAtiveSeverities()).to.include(SeverityLevel.critical);
    });

    it("should toggle severity filter off", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(true);

      await (filterCommand as any).filter(mockLogs, mockContext, SeverityLevel.critical, constants.criticalFilter);

      expect(filterCommand.getAtiveSeverities()).to.not.include(SeverityLevel.critical);
    });

    it("should update global state with new filter value", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(false);

      await (filterCommand as any).filter(mockLogs, mockContext, SeverityLevel.high, constants.highFilter);

      expect((mockContext.globalState.update as sinon.SinonStub).called).to.be.true;
    });

    it("should execute refresh tree command", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(true);

      await (filterCommand as any).filter(mockLogs, mockContext, SeverityLevel.medium, constants.mediumFilter);

      expect(executeCommandStub.called).to.be.true;
    });

    it("should log filter results", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(true);

      await (filterCommand as any).filter(mockLogs, mockContext, SeverityLevel.critical, constants.criticalFilter);

      expect((mockLogs.info as sinon.SinonStub).called).to.be.true;
    });
  });

  describe("filterState() method (private)", () => {
    it("should toggle state filter on", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(false);

      await (filterCommand as any).filterState(mockLogs, mockContext, StateLevel.proposed, constants.proposedFilter);

      expect(filterCommand.getActiveStates()).to.include(StateLevel.proposed);
    });

    it("should toggle state filter off", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(true);

      await (filterCommand as any).filterState(mockLogs, mockContext, StateLevel.confirmed, constants.confirmedFilter);

      expect(filterCommand.getActiveStates()).to.not.include(StateLevel.confirmed);
    });

    it("should update global state with new state value", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(false);

      await (filterCommand as any).filterState(mockLogs, mockContext, StateLevel.proposed, constants.proposedFilter);

      expect((mockContext.globalState.update as sinon.SinonStub).called).to.be.true;
    });

    it("should execute refresh tree command after state filter", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(true);

      await (filterCommand as any).filterState(mockLogs, mockContext, StateLevel.urgent, constants.urgentFilter);

      expect(executeCommandStub.called).to.be.true;
    });
  });

  describe("filterSCAHideDevTest() method (private)", () => {
    it("should toggle SCA hide dev test filter", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(false);

      await (filterCommand as any).filterSCAHideDevTest(mockLogs, mockContext, constants.scaHideDevTestFilter);

      expect((mockContext.globalState.update as sinon.SinonStub).called).to.be.true;
    });

    it("should execute refresh tree command", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();

      await (filterCommand as any).filterSCAHideDevTest(mockLogs, mockContext, constants.scaHideDevTestFilter);

      expect(executeCommandStub.called).to.be.true;
    });

    it("should log SCA filter message", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();

      await (filterCommand as any).filterSCAHideDevTest(mockLogs, mockContext, constants.scaHideDevTestFilter);

      expect((mockLogs.info as sinon.SinonStub).called).to.be.true;
    });
  });

  describe("registerFilters() method", () => {
    it("should register all filter commands", () => {
      const registerCommandStub = sandbox.stub(vscode.commands, "registerCommand").returns({
        dispose: () => {},
      } as any);

      filterCommand.registerFilters();

      expect(registerCommandStub.callCount).to.be.greaterThan(0);
      expect(mockContext.subscriptions.length).to.be.greaterThan(0);
    });
  });

  describe("initializeFilters() method", () => {
    it("should load severity filters from global state", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.criticalFilter).returns(true);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.highFilter).returns(false);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.mediumFilter).returns(true);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.lowFilter).returns(true);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.infoFilter).returns(true);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.notExploitableFilter).returns(false);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.proposedFilter).returns(false);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.confirmedFilter).returns(true);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.toVerifyFilter).returns(true);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.urgentFilter).returns(true);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.notIgnoredFilter).returns(true);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.ignoredFilter).returns(true);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.scaHideDevTestFilter).returns(false);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.allCustomStatesFilter).returns(true);

      await filterCommand.initializeFilters();

      expect((mockContext.globalState.update as sinon.SinonStub).called).to.be.true;
    });

    it("should refresh tree after initialization", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();

      await filterCommand.initializeFilters();

      expect(executeCommandStub.called).to.be.true;
    });

    it("should handle missing global state values with defaults", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(undefined);

      await filterCommand.initializeFilters();

      expect((mockContext.globalState.update as sinon.SinonStub).called).to.be.true;
    });
  });

  describe("Filter toggle edge cases", () => {
    it("should correctly toggle from true to false", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(true);

      const initialStates = filterCommand.getActiveStates();
      const hadConfirmed = initialStates.includes(StateLevel.confirmed);

      await (filterCommand as any).filterState(mockLogs, mockContext, StateLevel.confirmed, constants.confirmedFilter);

      const finalStates = filterCommand.getActiveStates();
      const hasConfirmed = finalStates.includes(StateLevel.confirmed);

      expect(hadConfirmed).to.not.equal(hasConfirmed);
    });

    it("should handle rapid sequential filter updates", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.criticalFilter).returns(true);
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.highFilter).returns(false);

      // First toggle: critical ON -> OFF
      await (filterCommand as any).filter(mockLogs, mockContext, SeverityLevel.critical, constants.criticalFilter);
      let severities = filterCommand.getAtiveSeverities();
      expect(severities).to.not.include(SeverityLevel.critical);

      // Update stub for second call
      (mockContext.globalState.get as sinon.SinonStub).withArgs(constants.criticalFilter).returns(false);

      // Second toggle: critical OFF -> ON
      await (filterCommand as any).filter(mockLogs, mockContext, SeverityLevel.critical, constants.criticalFilter);
      severities = filterCommand.getAtiveSeverities();
      expect(severities).to.include(SeverityLevel.critical);
    });

    it("should maintain state consistency across multiple operations", async () => {
      const executeCommandStub = sandbox.stub(vscode.commands, "executeCommand").resolves();
      (mockContext.globalState.get as sinon.SinonStub).returns(true);

      (filterCommand as any).updateSeverities(SeverityLevel.low, true);
      (filterCommand as any).updateSeverities(SeverityLevel.info, true);
      (filterCommand as any).updateState(StateLevel.proposed, true);

      const severities = filterCommand.getAtiveSeverities();
      const states = filterCommand.getActiveStates();

      expect(severities).to.include(SeverityLevel.low);
      expect(severities).to.include(SeverityLevel.info);
      expect(states).to.include(StateLevel.proposed);
    });
  });
});
