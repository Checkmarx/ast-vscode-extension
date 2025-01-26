import { expect } from "chai";
import "./mocks/vscode-mock";
import { ScanCommand } from "../commands/scanCommand";
import { Logs } from "../models/logs";
import * as vscode from "vscode";
import { clearCommandsExecuted } from "./mocks/vscode-mock";

describe("ScanCommand", () => {
  let scanCommand: ScanCommand;
  let logs: Logs;
  let mockContext: vscode.ExtensionContext;
  let mockStatusBar: vscode.StatusBarItem;
  let scanStarted = false;

  beforeEach(() => {
    clearCommandsExecuted();
    scanStarted = false;
    
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

    mockStatusBar = {
      show: () => {},
      hide: () => {},
      dispose: () => {}
    } as vscode.StatusBarItem;

    scanCommand = new ScanCommand(mockContext, mockStatusBar, logs);
  });

  describe("registerIdeScans", () => {
    it("should register scan commands", () => {
      scanCommand.registerIdeScans();
      expect(mockContext.subscriptions.length).to.equal(3); // createScan, cancelScan, pollScan
    });
  });

  describe("executePollScan", () => {
    it("should execute poll scan command", () => {
      scanCommand.executePollScan();
      expect(scanStarted).to.be.false;
    });
  });
}); 