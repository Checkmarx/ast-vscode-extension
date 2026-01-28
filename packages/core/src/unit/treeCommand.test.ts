import { expect } from "chai";
import "./mocks/vscode-mock";
import { TreeCommand } from "../commands/treeCommand";
import { Logs } from "../models/logs";
import * as vscode from "vscode";
import { clearCommandsExecuted } from "./mocks/vscode-mock";
import { AstResultsProvider } from "../views/resultsView/astResultsProvider";
import { SCAResultsProvider } from "../views/scaView/scaResultsProvider";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";

describe("TreeCommand", () => {
  let treeCommand: TreeCommand;
  let logs: Logs;
  let mockContext: vscode.ExtensionContext;
  let mockAstProvider: AstResultsProvider;
  let mockScaProvider: SCAResultsProvider;

  beforeEach(() => {
    clearCommandsExecuted();

    // Set up extension configuration before tests run
    setExtensionConfig({
      extensionId: 'ast-results',
      commandPrefix: 'ast-results',
      viewContainerPrefix: 'ast',
      displayName: 'Checkmarx',
      extensionType: 'checkmarx',
    });

    const mockOutputChannel = {
      append: () => {},
      appendLine: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
      replace: () => {},
      name: "Test"
    };

    logs = {
      info: () => {},
      error: () => {},
      output: mockOutputChannel,
      log: () => {},
      warn: () => {},
      show: () => {}
    } as Logs;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockContext = { subscriptions: [] } as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockAstProvider = { refreshData: async () => {}, clean: async () => {} } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockScaProvider = { refreshData: async () => {}, clean: async () => {} } as any;

    treeCommand = new TreeCommand(mockContext, mockAstProvider, mockScaProvider, logs);
  });

  afterEach(() => {
    resetExtensionConfig();
  });

  describe("registerRefreshCommands", () => {
    it("should register refresh commands", () => {
      treeCommand.registerRefreshCommands();
      expect(mockContext.subscriptions.length).to.be.greaterThan(0);
    });
  });

  describe("registerClearCommands", () => {
    it("should register clear commands", () => {
      treeCommand.registerClearCommands();
      expect(mockContext.subscriptions.length).to.be.greaterThan(0);
    });
  });
}); 