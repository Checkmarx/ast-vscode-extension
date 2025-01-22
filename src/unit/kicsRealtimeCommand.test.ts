import { expect } from "chai";
import "./mocks/vscode-mock";
import { KICSRealtimeCommand } from "../commands/kicsRealtimeCommand";
import { Logs } from "../models/logs";
import * as vscode from "vscode";
import {  clearCommandsExecuted } from "./mocks/vscode-mock";
import { KicsProvider } from "../kics/kicsRealtimeProvider";

describe("KICSRealtimeCommand", () => {
  let kicsCommand: KICSRealtimeCommand;
  let logs: Logs;
  let mockContext: vscode.ExtensionContext;
  let mockKicsProvider: KicsProvider;


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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockKicsProvider = { runKicsIfEnabled: async () => {} } as any;

    kicsCommand = new KICSRealtimeCommand(mockContext, mockKicsProvider, logs);
  });

  describe("registerKicsScans", () => {
    it("should register kics scan command", () => {
      kicsCommand.registerKicsScans();
      expect(mockContext.subscriptions.length).to.be.greaterThan(0);
    });
  });

  describe("registerSettings", () => {
    it("should register kics settings command", () => {
      kicsCommand.registerSettings();
      expect(mockContext.subscriptions.length).to.be.greaterThan(0);
    });
  });
}); 