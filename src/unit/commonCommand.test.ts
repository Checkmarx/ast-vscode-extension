import { expect } from "chai";
import "./mocks/vscode-mock";
import { CommonCommand } from "../commands/commonCommand";
import { Logs } from "../models/logs";
import * as vscode from "vscode";
import { getCommandsExecuted, clearCommandsExecuted } from "./mocks/vscode-mock";

describe("CommonCommand", () => {
  let commonCommand: CommonCommand;
  let logs: Logs;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    clearCommandsExecuted();
    
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

    commonCommand = new CommonCommand(mockContext, logs);
  });

  describe("executeCheckSettings", () => {
    it("should execute setContext command with correct parameters", () => {
      commonCommand.executeCheckSettings();
      expect(getCommandsExecuted()).to.include("setContext");
    });
  });
}); 