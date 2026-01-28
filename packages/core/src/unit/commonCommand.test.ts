import { expect } from "chai";
import "./mocks/vscode-mock";
import { CommonCommand } from "../commands/commonCommand";
import { Logs } from "../models/logs";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";

import { getCommandsExecuted, clearCommandsExecuted } from "./mocks/vscode-mock";

describe("CommonCommand", () => {
  let commonCommand: CommonCommand;
  let logs: Logs;
  let mockContext: any;

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

    commonCommand = new CommonCommand(mockContext, logs);
  });

  afterEach(() => {
    resetExtensionConfig();
  });

  describe("executeCheckSettings", () => {
    it("should execute setContext command with correct parameters", async() => {
      await commonCommand.executeCheckSettings();
      expect(getCommandsExecuted()).to.include("setContext");
    });
  });
}); 